import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { APP_VERSION } from '../lib/version.js';

export const healthRouter = Router();

const startedAt = Date.now();

healthRouter.get('/', async (_req, res) => {
  let database: 'UP' | 'DOWN' = 'UP';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'DOWN';
  }

  const status = database === 'UP' ? 'UP' : 'DOWN';
  res.status(status === 'UP' ? 200 : 503).json({
    status,
    database,
    version: APP_VERSION,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
  });
});
