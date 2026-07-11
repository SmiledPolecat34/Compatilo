import { z } from 'zod';

// Charge .env en développement ; en production (Render), les variables
// sont fournies par la plateforme et le fichier n'existe pas.
try {
  process.loadEnvFile();
} catch {
  /* pas de fichier .env */
}

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  PIN_PEPPER: z.string().min(16),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // 2FA
  TOTP_ISSUER: z.string().default('Compatilo'),
  TRUSTED_DEVICE_DAYS: z.coerce.number().min(1).max(365).default(30),

  // Envoi d'e-mail applicatif. La connexion admin n'utilise plus de code
  // par e-mail : le second facteur est uniquement Google Authenticator.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('Compatilo <no-reply@compatilo.app>'),

  // Stockage des fichiers audio uploadés (musique)
  MUSIC_UPLOAD_DIR: z.string().default('uploads/audio'),
  MUSIC_MAX_FILE_MB: z.coerce.number().default(50),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuration invalide :', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
