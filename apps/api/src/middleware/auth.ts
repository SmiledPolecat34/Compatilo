import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../lib/jwt.js';
import { unauthorized } from '../lib/errors.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      adminId?: string;
      participant?: { participantId: string; sessionId: string };
    }
  }
}

function bearerOrCookie(req: Request, cookieName: string): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.[cookieName];
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const token = bearerOrCookie(req, 'compatilo_admin');
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.kind !== 'admin') {
    next(unauthorized());
    return;
  }
  req.adminId = payload.adminId;
  next();
}

export function requireParticipant(req: Request, _res: Response, next: NextFunction) {
  const token = bearerOrCookie(req, 'compatilo_participant');
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.kind !== 'participant') {
    next(unauthorized('Session expirée, entre à nouveau ton code PIN.'));
    return;
  }
  req.participant = { participantId: payload.participantId, sessionId: payload.sessionId };
  next();
}
