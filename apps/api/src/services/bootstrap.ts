import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/crypto.js';
import { DEFAULT_QUESTIONNAIRE } from '../domain/defaultQuestionnaire.js';

/**
 * Initialisation idempotente exécutée au démarrage :
 * crée le compte admin (depuis les variables d'environnement) et le
 * questionnaire par défaut s'ils n'existent pas encore.
 */
export async function bootstrap() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (email && password) {
    const existing = await prisma.admin.findUnique({ where: { email } });
    if (!existing) {
      await prisma.admin.create({
        data: { email, passwordHash: await hashPassword(password) },
      });
      console.log(`Compte admin créé : ${email}`);
    }
  }

  const count = await prisma.questionnaire.count();
  if (count === 0) {
    await prisma.questionnaire.create({
      data: {
        title: DEFAULT_QUESTIONNAIRE.title,
        description: DEFAULT_QUESTIONNAIRE.description,
        versions: {
          create: {
            version: 1,
            status: 'PUBLISHED',
            publishedAt: new Date(),
            pages: {
              create: DEFAULT_QUESTIONNAIRE.pages.map((p, pi) => ({
                title: p.title,
                description: p.description,
                position: pi,
                questions: {
                  create: p.questions.map((prompt, qi) => ({
                    type: 'trilean',
                    prompt,
                    position: qi,
                    config: {},
                  })),
                },
              })),
            },
          },
        },
      },
    });
    console.log(`Questionnaire « ${DEFAULT_QUESTIONNAIRE.title} » (v1) publié.`);
  }
}
