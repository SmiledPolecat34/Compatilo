import pino from 'pino';
import { isProd } from '../config/env.js';

/**
 * Logs structurés (JSON en production, lisibles en développement).
 * Utilisé pour les logs serveur généraux ainsi que pour la journalisation
 * des erreurs API et front (voir middleware/errorHandler.ts et
 * routes/monitoring.ts).
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
});
