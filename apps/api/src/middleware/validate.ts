import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { badRequest } from '../lib/errors.js';

/** Valide et remplace req.body — la validation backend est systématique. */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const first = result.error.issues[0];
      next(badRequest(`Données invalides : ${first.path.join('.')} — ${first.message}`));
      return;
    }
    req.body = result.data;
    next();
  };
}
