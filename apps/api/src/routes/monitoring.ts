import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { logger } from '../lib/logger.js';
import { validateBody } from '../middleware/validate.js';

export const monitoringRouter = Router();

const clientErrorLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const clientErrorSchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(4000).optional(),
  url: z.string().max(500).optional(),
  source: z.enum(['error_boundary', 'window_error', 'unhandled_rejection']).default('window_error'),
});

// Journalise côté serveur les erreurs survenues dans le navigateur — pas de
// stockage en base : ce sont des logs d'exploitation, pas des données produit.
monitoringRouter.post('/client-errors', clientErrorLimiter, validateBody(clientErrorSchema), (req, res) => {
  logger.error(
    {
      kind: 'client_error',
      source: req.body.source,
      url: req.body.url,
      stack: req.body.stack,
      userAgent: req.headers['user-agent'],
    },
    req.body.message,
  );
  res.status(204).end();
});
