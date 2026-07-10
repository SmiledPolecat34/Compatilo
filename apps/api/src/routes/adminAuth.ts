import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { verifyPassword } from '../lib/crypto.js';
import { generateTotpSecret, totpProvisioningUri, verifyTotp } from '../lib/totp.js';
import { signToken, verifyToken } from '../lib/jwt.js';
import { badRequest, notFound, tooMany, unauthorized } from '../lib/errors.js';
import { requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

export const adminAuthRouter = Router();

const MAX_OTP_ATTEMPTS = 5;
const OTP_LOCK_MS = 15 * 60 * 1000;

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

function issueAdminSession(adminId: string, email: string, tokenVersion: number) {
  const token = signToken({ kind: 'admin', adminId, tokenVersion }, '12h');
  return { token, email };
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

adminAuthRouter.post('/login', loginLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const admin = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
    const ok = admin ? await verifyPassword(password, admin.passwordHash) : false;
    if (!admin || !ok) throw unauthorized('Identifiants incorrects.');

    if (admin.otpLockedUntil && admin.otpLockedUntil > new Date()) {
      throw tooMany('Trop de tentatives. Réessaie dans quelques minutes.');
    }

    if (!admin.totpEnabled || !admin.totpSecret) {
      res.json({
        ...issueAdminSession(admin.id, admin.email, admin.tokenVersion),
        twoFactorSetupRequired: true,
      });
      return;
    }

    const pendingToken = signToken({ kind: 'admin_pending', adminId: admin.id }, '10m');
    res.json({ requires2FA: true, method: 'TOTP', pendingToken });
  } catch (err) {
    next(err);
  }
});

const verifySchema = z.object({
  pendingToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'Code à 6 chiffres attendu'),
});

adminAuthRouter.post('/verify-2fa', otpLimiter, validateBody(verifySchema), async (req, res, next) => {
  try {
    const { pendingToken, code } = req.body;
    const payload = verifyToken(pendingToken);
    if (!payload || payload.kind !== 'admin_pending') {
      throw unauthorized('Session de connexion expirée, recommence.');
    }

    const admin = await prisma.admin.findUnique({ where: { id: payload.adminId } });
    if (!admin) throw notFound();

    if (admin.otpLockedUntil && admin.otpLockedUntil > new Date()) {
      throw tooMany('Trop de tentatives. Réessaie dans quelques minutes.');
    }

    const valid = admin.totpEnabled && admin.totpSecret ? await verifyTotp(code, admin.totpSecret) : false;
    if (!valid) {
      const attempts = admin.otpAttempts + 1;
      await prisma.admin.update({
        where: { id: admin.id },
        data: {
          otpAttempts: attempts,
          otpLockedUntil: attempts >= MAX_OTP_ATTEMPTS ? new Date(Date.now() + OTP_LOCK_MS) : null,
        },
      });
      throw unauthorized('Code Google Authenticator invalide.');
    }

    await prisma.admin.update({
      where: { id: admin.id },
      data: { otpAttempts: 0, otpLockedUntil: null, otpCodeHash: null, otpExpiresAt: null },
    });

    res.json(issueAdminSession(admin.id, admin.email, admin.tokenVersion));
  } catch (err) {
    next(err);
  }
});

adminAuthRouter.post('/resend-otp', (_req, _res, next) => {
  next(badRequest("L'envoi de code par e-mail est désactivé. Utilise Google Authenticator."));
});

adminAuthRouter.post('/logout', (_req, res) => {
  res.json({ ok: true });
});

adminAuthRouter.get('/me', requireAdmin, async (req, res) => {
  const admin = await prisma.admin.findUnique({ where: { id: req.adminId! } });
  res.json({ email: admin?.email });
});

adminAuthRouter.post('/refresh', requireAdmin, async (req, res, next) => {
  try {
    const admin = await prisma.admin.findUniqueOrThrow({ where: { id: req.adminId! } });
    res.json(issueAdminSession(admin.id, admin.email, admin.tokenVersion));
  } catch (err) {
    next(err);
  }
});

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

adminAuthRouter.get('/2fa', requireAdmin, async (req, res, next) => {
  try {
    const admin = await prisma.admin.findUniqueOrThrow({ where: { id: req.adminId! } });
    res.json({
      method: 'TOTP',
      totpEnabled: admin.totpEnabled,
    });
  } catch (err) {
    next(err);
  }
});

adminAuthRouter.post('/2fa/totp/setup', requireAdmin, async (req, res, next) => {
  try {
    const admin = await prisma.admin.findUniqueOrThrow({ where: { id: req.adminId! } });
    const secret = generateTotpSecret();
    await prisma.admin.update({
      where: { id: admin.id },
      data: { totpSecret: secret, twoFactorMethod: 'TOTP' },
    });
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
      if (!(await verifyTotp(req.body.code, admin.totpSecret))) {
        throw badRequest('Code Google Authenticator invalide.');
      }
      await prisma.admin.update({
        where: { id: admin.id },
        data: { totpEnabled: true, twoFactorMethod: 'TOTP', otpCodeHash: null, otpExpiresAt: null },
      });
      await prisma.trustedDevice.deleteMany({ where: { adminId: admin.id } });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

adminAuthRouter.post('/2fa/totp/disable', requireAdmin, async (_req, _res, next) => {
  next(badRequest('Google Authenticator est la seule méthode 2FA disponible.'));
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
