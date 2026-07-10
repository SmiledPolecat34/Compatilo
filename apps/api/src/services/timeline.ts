import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';

/** Journalisation horodatée des actions importantes d'une session. */
export async function logEvent(
  sessionId: string,
  type: string,
  message: string,
  meta?: Prisma.InputJsonValue,
) {
  await prisma.timelineEvent.create({
    data: { sessionId, type, message, meta },
  });
}
