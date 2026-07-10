import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AdminToken {
  kind: 'admin';
  adminId: string;
}

export interface ParticipantToken {
  kind: 'participant';
  participantId: string;
  sessionId: string;
}

type TokenPayload = AdminToken | ParticipantToken;

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
