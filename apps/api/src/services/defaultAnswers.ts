import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

/** Préremplit les réponses d'un nouveau participant avec les valeurs de base définies par l'admin. */
export async function applyDefaultAnswers(participantId: string, versionId: string) {
  const questions = await prisma.question.findMany({
    where: {
      isActive: true,
      defaultValue: { not: Prisma.DbNull },
      page: { versionId, isActive: true },
    },
    select: { id: true, defaultValue: true },
  });
  if (questions.length === 0) return;

  await prisma.answer.createMany({
    data: questions.map((q) => ({
      participantId,
      questionId: q.id,
      value: q.defaultValue as object,
    })),
    skipDuplicates: true,
  });
}
