import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/errors.js';
import { isProd } from '../config/env.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  console.error(err);
  res.status(500).json({
    error: isProd ? 'Erreur interne du serveur' : String(err),
  });
}
