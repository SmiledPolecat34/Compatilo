import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/errors.js';
import { isProd } from '../config/env.js';
import { logger } from '../lib/logger.js';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    // 4xx : attendu (validation, auth...) — bruit normal, pas une erreur serveur
    if (err.status >= 500) {
      logger.error({ err, method: req.method, path: req.originalUrl, status: err.status }, err.message);
    } else {
      logger.warn({ method: req.method, path: req.originalUrl, status: err.status, code: err.code }, err.message);
    }
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }

  logger.error({ err, method: req.method, path: req.originalUrl }, 'Erreur API non gérée');
  res.status(500).json({
    error: isProd ? 'Erreur interne du serveur' : String(err),
  });
}
