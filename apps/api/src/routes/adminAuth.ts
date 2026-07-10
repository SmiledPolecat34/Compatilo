import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  generateDeviceToken,
  generateOtpCode,
  hashCode,
  hashDeviceToken,
  verifyCode,
  verifyPassword,
} from '../lib/crypto.js';
import { generateTotpSecret, totpProvisioningUri, verifyTotp } from '../lib/totp.js';
import { sendOtpEmail } from '../lib/mailer.js';
import { signToken, verifyToken } from '../lib/jwt.js';
import { badRequest, notFound, tooMany, unauthorized } from '../lib/errors.js';
import { requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { isProd, env } from '../config/env.js';

export const adminAuthRouter = Router();

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const OTP_LOCK_MS = 15 * 60 * 1000;
const TRUSTED_DEVICE_COOKIE = 'compatilo_trusted_device';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion.' },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessaie plus tard.' },
});

function trustedDeviceCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    // "none" en production : frontend (Netlify) et API (Render) sont deux
    // origines distinctes. Contrairement à l'ancien cookie d'accès admin
    // (supprimé), celui-ci ne sert qu'à sauter le défi 2FA sur un login où
    // le mot de passe a déjà été vérifié — impact limité en cas d'abus.
    sameSite: isProd ? ('none' as const) : ('lax' as const),
    maxAge: env.TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000,
    path: '/api/admin/auth',
  };
}

function activeMethod(admin: { twoFactorMethod: string; totpEnabled: boolean }) {
  return admin.totpEnabled ? 'TOTP' : admin.twoFactorMethod === 'TOTP' ? 'TOTP' : 'EMAIL_OTP';
}

// L'unique jeton d'accès admin est renvoyé dans le corps de la réponse et
// stocké côté client (jamais en cookie) : immunité CSRF de fait, puisque le
// navigateur ne l'attache jamais automatiquement à une requête forgée.
function issueAdminSession(adminId: string, email: string, tokenVersion: number) {
  const token = signToken({ kind: 'admin', adminId, tokenVersion }, '12h');
  return { token, email };
}

async function isTrustedDevice(req: import('express').Request, adminId: string): Promise<boolean> {
  const raw = req.cookies?.[TRUSTED_DEVICE_COOKIE];
  if (!raw) return false;
  const device = await prisma.trustedDevice.findUnique({ where: { tokenHash: hashDeviceToken(raw) } });
  if (!device || device.adminId !== adminId || device.expiresAt < new Date()) return false;
  await prisma.trustedDevice.update({ where: { id: device.id }, data: { lastUsedAt: new Date() } });
  return true;
}

// ── Étape 1 : mot de passe ────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

adminAuthRouter.post('/login', loginLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const admin = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
    // Comparaison systématique pour éviter les attaques temporelles sur l'email
    const ok = admin ? await verifyPassword(password, admin.passwordHash) : false;
    if (!admin || !ok) throw unauthorized('Identifiants incorrects.');

    if (await isTrustedDevice(req, admin.id)) {
      const session = issueAdminSession(admin.id, admin.email, admin.tokenVersion);
      res.json({ ...session, twoFactorSkipped: true });
      return;
    }

    if (admin.otpLockedUntil && admin.otpLockedUntil > new Date()) {
      throw tooMany('Trop de tentatives. Réessaie dans quelques minutes.');
    }

    const method = activeMethod(admin);
    const pendingToken = signToken({ kind: 'admin_pending', adminId: admin.id }, '10m');

    if (method === 'EMAIL_OTP') {
      const code = generateOtpCode();
      await prisma.admin.update({
        where: { id: admin.id },
        data: {
          otpCodeHash: await hashCode(code),
          otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
          otpAttempts: 0,
          otpLockedUntil: null,
        },
      });
      try {
        await sendOtpEmail(admin.email, code);
      } catch (err) {
        console.error('Échec envoi OTP :', err);
        throw badRequest("Échec de l'envoi du code, réessaie dans un instant.");
      }
    }

    res.json({ requires2FA: true, method, pendingToken });
  } catch (err) {
    next(err);
  }
});

// ── Étape 2 : code OTP (e-mail) ou TOTP ───────────────────────────────
const verifySchema = z.object({
  pendingToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'Code à 6 chiffres attendu'),
  rememberDevice: z.boolean().optional(),
});

adminAuthRouter.post('/verify-2fa', otpLimiter, validateBody(verifySchema), async (req, res, next) => {
  try {
    const { pendingToken, code, rememberDevice } = req.body;
    const payload = verifyToken(pendingToken);
    if (!payload || payload.kind !== 'admin_pending') {
      throw unauthorized('Session de connexion expirée, recommence.');
    }

    const admin = await prisma.admin.findUnique({ where: { id: payload.adminId } });
    if (!admin) throw notFound();

    if (admin.otpLockedUntil && admin.otpLockedUntil > new Date()) {
      throw tooMany('Trop de tentatives. Réessaie dans quelques minutes.');
    }

    const method = activeMethod(admin);
    const valid =
      method === 'TOTP'
        ? admin.totpSecret
          ? await verifyTotp(code, admin.totpSecret)
          : false
        : admin.otpCodeHash && admin.otpExpiresAt && admin.otpExpiresAt > new Date()
          ? await verifyCode(code, admin.otpCodeHash)
          : false;

    if (!valid) {
      const attempts = admin.otpAttempts + 1;
      await prisma.admin.update({
        where: { id: admin.id },
        data: {
          otpAttempts: attempts,
          otpLockedUntil: attempts >= MAX_OTP_ATTEMPTS ? new Date(Date.now() + OTP_LOCK_MS) : null,
        },
      });
      throw unauthorized('Code invalide.');
    }

    await prisma.admin.update({
      where: { id: admin.id },
      data: { otpAttempts: 0, otpLockedUntil: null, otpCodeHash: null, otpExpiresAt: null },
    });

    const session = issueAdminSession(admin.id, admin.email, admin.tokenVersion);

    if (rememberDevice) {
      const deviceToken = generateDeviceToken();
      await prisma.trustedDevice.create({
        data: {
          adminId: admin.id,
          tokenHash: hashDeviceToken(deviceToken),
          label: (req.headers['user-agent'] ?? '').toString().slice(0, 200) || null,
          expiresAt: new Date(Date.now() + env.TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000),
        },
      });
      res.cookie(TRUSTED_DEVICE_COOKIE, deviceToken, trustedDeviceCookieOptions());
    }

    res.json(session);
  } catch (err) {
    next(err);
  }
});

// ── Renvoyer un code OTP (e-mail uniquement) ──────────────────────────
const resendSchema = z.object({ pendingToken: z.string().min(1) });

adminAuthRouter.post('/resend-otp', otpLimiter, validateBody(resendSchema), async (req, res, next) => {
  try {
    const payload = verifyToken(req.body.pendingToken);
    if (!payload || payload.kind !== 'admin_pending') throw unauthorized('Session expirée.');
    const admin = await prisma.admin.findUnique({ where: { id: payload.adminId } });
    if (!admin) throw notFound();
    if (admin.otpLockedUntil && admin.otpLockedUntil > new Date()) {
      throw tooMany('Trop de tentatives. Réessaie dans quelques minutes.');
    }
    if (activeMethod(admin) !== 'EMAIL_OTP') {
      throw badRequest('Utilise ton application d’authentification.');
    }

    const code = generateOtpCode();
    await prisma.admin.update({
      where: { id: admin.id },
      data: { otpCodeHash: await hashCode(code), otpExpiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });
    await sendOtpEmail(admin.email, code);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminAuthRouter.post('/logout', (_req, res) => {
  res.json({ ok: true });
});

adminAuthRouter.get('/me', requireAdmin, async (req, res) => {
  const admin = await prisma.admin.findUnique({ where: { id: req.adminId! } });
  res.json({ email: admin?.email });
});

// ── Rotation : ré-émet un jeton frais (prolonge la session sans mot de passe) ──
adminAuthRouter.post('/refresh', requireAdmin, async (req, res, next) => {
  try {
    const admin = await prisma.admin.findUniqueOrThrow({ where: { id: req.adminId! } });
    res.json(issueAdminSession(admin.id, admin.email, admin.tokenVersion));
  } catch (err) {
    next(err);
  }
});

// ── Révocation : invalide instantanément tous les jetons déjà émis ───
// ("déconnexion de tous les appareils"), y compris celui de cette requête.
adminAuthRouter.post('/revoke-all', requireAdmin, async (req, res, next) => {
  try {
    await prisma.admin.update({
      where: { id: req.adminId! },
      data: { tokenVersion: { increment: 1 } },
    });
    await prisma.trustedDevice.deleteMany({ where: { adminId: req.adminId! } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Réglages 2FA (une fois connecté) ──────────────────────────────────
adminAuthRouter.get('/2fa', requireAdmin, async (req, res, next) => {
  try {
    const admin = await prisma.admin.findUniqueOrThrow({ where: { id: req.adminId! } });
    const devices = await prisma.trustedDevice.findMany({
      where: { adminId: admin.id },
      orderBy: { lastUsedAt: 'desc' },
    });
    res.json({
      method: activeMethod(admin),
      totpEnabled: admin.totpEnabled,
      trustedDeviceDays: env.TRUSTED_DEVICE_DAYS,
      trustedDevices: devices.map((d) => ({
        id: d.id,
        label: d.label,
        createdAt: d.createdAt,
        lastUsedAt: d.lastUsedAt,
        expiresAt: d.expiresAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

adminAuthRouter.post('/2fa/totp/setup', requireAdmin, async (req, res, next) => {
  try {
    const admin = await prisma.admin.findUniqueOrThrow({ where: { id: req.adminId! } });
    const secret = generateTotpSecret();
    await prisma.admin.update({ where: { id: admin.id }, data: { totpSecret: secret } });
    res.json({ secret, otpauthUrl: totpProvisioningUri(secret, admin.email) });
  } catch (err) {
    next(err);
  }
});

const enableTotpSchema = z.object({ code: z.string().regex(/^\d{6}$/) });

adminAuthRouter.post(
  '/2fa/totp/enable',
  requireAdmin,
  validateBody(enableTotpSchema),
  async (req, res, next) => {
    try {
      const admin = await prisma.admin.findUniqueOrThrow({ where: { id: req.adminId! } });
      if (!admin.totpSecret) throw badRequest("Lance d'abord l'enrôlement.");
      if (!(await verifyTotp(req.body.code, admin.totpSecret))) throw badRequest('Code invalide.');
      await prisma.admin.update({
        where: { id: admin.id },
        data: { totpEnabled: true, twoFactorMethod: 'TOTP' },
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

adminAuthRouter.post('/2fa/totp/disable', requireAdmin, async (req, res, next) => {
  try {
    await prisma.admin.update({
      where: { id: req.adminId! },
      data: { totpEnabled: false, totpSecret: null, twoFactorMethod: 'EMAIL_OTP' },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminAuthRouter.delete('/2fa/trusted-devices/:id', requireAdmin, async (req, res, next) => {
  try {
    const device = await prisma.trustedDevice.findUnique({ where: { id: req.params.id } });
    if (!device || device.adminId !== req.adminId) throw notFound();
    await prisma.trustedDevice.delete({ where: { id: device.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
