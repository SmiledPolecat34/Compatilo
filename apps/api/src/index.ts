import { env } from './config/env.js';
import { createApp } from './app.js';
import { bootstrap } from './services/bootstrap.js';

const app = createApp();

bootstrap()
  .then(() => {
    app.listen(env.PORT, () => {
      console.log(`Compatilo API démarrée sur le port ${env.PORT} (${env.NODE_ENV})`);
    });
  })
  .catch((err) => {
    console.error('Échec du démarrage :', err);
    process.exit(1);
  });
