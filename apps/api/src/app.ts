import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { publicRouter } from './routes/public.js';
import { adminAuthRouter } from './routes/adminAuth.js';
import { adminSessionsRouter } from './routes/adminSessions.js';
import { adminQuestionnairesRouter } from './routes/adminQuestionnaires.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // Render est derrière un proxy
  app.use(helmet());
  app.use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '512kb' })); // signatures PNG en data URL
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/public', publicRouter);
  app.use('/api/admin/auth', adminAuthRouter);
  app.use('/api/admin/sessions', adminSessionsRouter);
  app.use('/api/admin/questionnaires', adminQuestionnairesRouter);

  app.use((_req, res) => res.status(404).json({ error: 'Route introuvable' }));
  app.use(errorHandler);

  return app;
}
