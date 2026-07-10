/* Seed de développement : réutilise le bootstrap idempotent de l'API. */
import { bootstrap } from '../src/services/bootstrap.js';
import { prisma } from '../src/lib/prisma.js';

// Le bootstrap lit ADMIN_EMAIL / ADMIN_PASSWORD depuis l'environnement
try {
  process.loadEnvFile();
} catch {
  /* pas de fichier .env */
}

bootstrap()
  .then(() => console.log('Seed terminé.'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
