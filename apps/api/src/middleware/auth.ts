import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../lib/jwt.js';
import { unauthorized } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      adminId?: string;
      participant?: { participantId: string; sessionId: string };
    }
  }
}

// Jeton lu uniquement dans l'en-tête Authorization : jamais dans un cookie,
// pour qu'aucune requête cross-site forgée (CSRF) ne puisse être authentifiée
// automatiquement par le navigateur.
function bearer(req: Request): string | undefined {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = bearer(req);
    const payload = token ? verifyToken(token) : null;
    if (!payload || payload.kind !== 'admin') {
      next(unauthorized());
      return;
    }
    const admin = await prisma.admin.findUnique({
      where: { id: payload.adminId },
      select: { tokenVersion: true },
    });
    if (!admin || admin.tokenVersion !== payload.tokenVersion) {
      next(unauthorized('Session invalidée, reconnecte-toi.'));
      return;
    }
    req.adminId = payload.adminId;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireParticipant(req: Request, _res: Response, next: NextFunction) {
  const token = bearer(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.kind !== 'participant') {
    next(unauthorized('Session expirée, entre à nouveau ton code PIN.'));
    return;
  }
  req.participant = { participantId: payload.participantId, sessionId: payload.sessionId };
  next();
}
