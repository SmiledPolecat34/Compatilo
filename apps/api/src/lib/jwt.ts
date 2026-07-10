import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AdminToken {
  kind: 'admin';
  adminId: string;
}

// Émis après le mot de passe, avant le second facteur : ne donne accès
// qu'aux routes de vérification 2FA, jamais aux routes admin protégées.
export interface AdminPendingToken {
  kind: 'admin_pending';
  adminId: string;
}

export interface ParticipantToken {
  kind: 'participant';
  participantId: string;
  sessionId: string;
}

type TokenPayload = AdminToken | AdminPendingToken | ParticipantToken;

export function signToken(payload: TokenPayload, expiresIn: string): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}
