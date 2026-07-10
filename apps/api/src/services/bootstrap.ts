import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/crypto.js';
import { DEFAULT_QUESTIONNAIRE, type DefaultPage } from '../domain/defaultQuestionnaire.js';

/**
 * Initialisation idempotente exécutée au démarrage :
 * crée le compte admin et publie la version de référence du questionnaire
 * si la base ne contient pas encore la version conforme à la spec actuelle.
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

  await ensureDefaultQuestionnaire();
}

function pageSignature(pages: DefaultPage[]) {
  return JSON.stringify(
    pages.map((p) => ({
      title: p.title,
      questions: p.questions.map((q) => ({
        type: q.type,
        prompt: q.prompt,
        required: q.required ?? true,
        config: q.config ?? {},
      })),
    })),
  );
}

async function ensureDefaultQuestionnaire() {
  const expectedSignature = pageSignature(DEFAULT_QUESTIONNAIRE.pages);
  const existing = await prisma.questionnaire.findFirst({
    where: { title: DEFAULT_QUESTIONNAIRE.title },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        include: {
          pages: {
            orderBy: { position: 'asc' },
            include: { questions: { orderBy: { position: 'asc' } } },
          },
        },
      },
    },
  });

  const latest = existing?.versions[0];
  const latestSignature = latest
    ? pageSignature(
        latest.pages.map((p) => ({
          title: p.title,
          questions: p.questions.map((q) => ({
            type: q.type,
            prompt: q.prompt,
            required: q.required,
            config: q.config as Record<string, unknown>,
          })),
        })),
      )
    : null;

  if (latest?.status === 'PUBLISHED' && latestSignature === expectedSignature) return;

  const questionnaire =
    existing ??
    (await prisma.questionnaire.create({
      data: {
        title: DEFAULT_QUESTIONNAIRE.title,
        description: DEFAULT_QUESTIONNAIRE.description,
      },
    }));
  const versionNumber = latest ? latest.version + 1 : 1;

  await prisma.$transaction(async (tx) => {
    await tx.questionnaireVersion.updateMany({
      where: { questionnaireId: questionnaire.id, status: 'PUBLISHED' },
      data: { status: 'ARCHIVED' },
    });
    await tx.questionnaireVersion.create({
      data: {
        questionnaireId: questionnaire.id,
        version: versionNumber,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        pages: {
          create: DEFAULT_QUESTIONNAIRE.pages.map((p, pi) => ({
            title: p.title,
            description: p.description ?? null,
            position: pi,
            questions: {
              create: p.questions.map((q, qi) => ({
                type: q.type,
                prompt: q.prompt,
                helpText: q.helpText ?? null,
                position: qi,
                required: q.required ?? true,
                config: (q.config ?? {}) as Prisma.InputJsonValue,
              })),
            },
          })),
        },
      },
    });
  });

  console.log(`Questionnaire « ${DEFAULT_QUESTIONNAIRE.title} » (v${versionNumber}) publié.`);
}
