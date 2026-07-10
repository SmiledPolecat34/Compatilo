import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { verifyPassword } from '../lib/crypto.js';
import { signToken } from '../lib/jwt.js';
import { unauthorized } from '../lib/errors.js';
import { requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { isProd } from '../config/env.js';

export const adminAuthRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion.' },
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? ('none' as const) : ('lax' as const),
  maxAge: 12 * 60 * 60 * 1000,
  path: '/',
};

adminAuthRouter.post('/login', loginLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const admin = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
    // Comparaison systématique pour éviter les attaques temporelles sur l'email
    const ok = admin ? await verifyPassword(password, admin.passwordHash) : false;
    if (!admin || !ok) throw unauthorized('Identifiants incorrects.');

    const token = signToken({ kind: 'admin', adminId: admin.id }, '12h');
    res.cookie('compatilo_admin', token, cookieOptions);
    res.json({ token, email: admin.email });
  } catch (err) {
    next(err);
  }
});

adminAuthRouter.post('/logout', (_req, res) => {
  res.clearCookie('compatilo_admin', { path: '/' });
  res.json({ ok: true });
});

adminAuthRouter.get('/me', requireAdmin, async (req, res) => {
  const admin = await prisma.admin.findUnique({ where: { id: req.adminId! } });
  res.json({ email: admin?.email });
});
