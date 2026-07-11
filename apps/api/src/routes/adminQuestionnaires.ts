import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

export const adminQuestionnairesRouter = Router();
adminQuestionnairesRouter.use(requireAdmin);

// ── Liste ────────────────────────────────────────────────────────────
adminQuestionnairesRouter.get('/', async (_req, res, next) => {
  try {
    const questionnaires = await prisma.questionnaire.findMany({
      include: {
        versions: {
          orderBy: { version: 'desc' },
          select: { id: true, version: true, status: true, publishedAt: true },
        },
        _count: { select: { versions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(questionnaires);
  } catch (err) {
    next(err);
  }
});

// ── Création ─────────────────────────────────────────────────────────
const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
});

adminQuestionnairesRouter.post('/', validateBody(createSchema), async (req, res, next) => {
  try {
    const questionnaire = await prisma.questionnaire.create({
      data: {
        title: req.body.title,
        description: req.body.description || null,
        versions: { create: { version: 1, status: 'DRAFT' } },
      },
      include: { versions: true },
    });
    res.status(201).json(questionnaire);
  } catch (err) {
    next(err);
  }
});

// ── Renommage du questionnaire ────────────────────────────────────────
const renameSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
});

adminQuestionnairesRouter.patch('/:id', validateBody(renameSchema), async (req, res, next) => {
  try {
    const questionnaire = await prisma.questionnaire.update({
      where: { id: req.params.id },
      data: {
        title: req.body.title,
        ...(req.body.description !== undefined ? { description: req.body.description } : {}),
      },
    });
    res.json(questionnaire);
  } catch (err) {
    next(err);
  }
});

// ── Détail d'une version (structure complète) ────────────────────────
adminQuestionnairesRouter.get('/versions/:versionId', async (req, res, next) => {
  try {
    const version = await prisma.questionnaireVersion.findUnique({
      where: { id: req.params.versionId },
      include: {
        questionnaire: { select: { id: true, title: true, description: true } },
        pages: {
          orderBy: { position: 'asc' },
          include: { questions: { orderBy: { position: 'asc' } } },
        },
      },
    });
    if (!version) throw notFound();
    res.json(version);
  } catch (err) {
    next(err);
  }
});

// ── Remplacement de la structure d'un brouillon ──────────────────────
// L'éditeur (pages, questions, ordre, activation) sauvegarde la
// structure entière : simple, atomique, et sans dérive d'état.
const structureSchema = z.object({
  pages: z
    .array(
      z.object({
        id: z.string().optional(), // absent = nouvelle page
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(500).nullable().optional(),
        isActive: z.boolean().default(true),
        questions: z
          .array(
            z.object({
              id: z.string().optional(),
              type: z.string().trim().min(1).max(40).default('trilean'),
              prompt: z.string().trim().min(1).max(500),
              helpText: z.string().trim().max(500).nullable().optional(),
              isActive: z.boolean().default(true),
              required: z.boolean().default(true),
              config: z.record(z.unknown()).default({}),
            }),
          )
          .max(100),
      }),
    )
    .max(50),
});

adminQuestionnairesRouter.put(
  '/versions/:versionId/structure',
  validateBody(structureSchema),
  async (req, res, next) => {
    try {
      const version = await prisma.questionnaireVersion.findUnique({
        where: { id: req.params.versionId },
      });
      if (!version) throw notFound();
      if (version.status !== 'DRAFT') {
        throw conflict('Seul un brouillon peut être modifié. Crée une nouvelle version.');
      }

      const { pages } = req.body as z.infer<typeof structureSchema>;

      await prisma.$transaction(async (tx) => {
        const keptPageIds = pages.map((p) => p.id).filter((x): x is string => Boolean(x));
        await tx.page.deleteMany({
          where: { versionId: version.id, id: { notIn: keptPageIds } },
        });

        for (let pi = 0; pi < pages.length; pi += 1) {
          const p = pages[pi];
          const pageData = {
            title: p.title,
            description: p.description ?? null,
            position: pi,
            isActive: p.isActive,
          };
          const page = p.id
            ? await tx.page.update({ where: { id: p.id }, data: pageData })
            : await tx.page.create({ data: { ...pageData, versionId: version.id } });

          const keptQuestionIds = p.questions
            .map((q) => q.id)
            .filter((x): x is string => Boolean(x));
          await tx.question.deleteMany({
            where: { pageId: page.id, id: { notIn: keptQuestionIds } },
          });

          for (let qi = 0; qi < p.questions.length; qi += 1) {
            const q = p.questions[qi];
            const questionData = {
              type: q.type,
              prompt: q.prompt,
              helpText: q.helpText ?? null,
              position: qi,
              isActive: q.isActive,
              required: q.required,
              config: q.config as object,
              pageId: page.id,
            };
            if (q.id) {
              await tx.question.update({ where: { id: q.id }, data: questionData });
            } else {
              await tx.question.create({ data: questionData });
            }
          }
        }
      });

      const updated = await prisma.questionnaireVersion.findUnique({
        where: { id: version.id },
        include: {
          pages: { orderBy: { position: 'asc' }, include: { questions: { orderBy: { position: 'asc' } } } },
        },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// ── Réponses par défaut (préremplies à la création d'un participant) ──
// Indépendant du statut de la version : sert surtout sur la version
// PUBLISHED, celle réellement utilisée par les nouvelles sessions.
const defaultAnswersSchema = z.object({
  answers: z
    .array(z.object({ questionId: z.string().min(1), value: z.unknown() }))
    .max(200),
});

adminQuestionnairesRouter.patch(
  '/versions/:versionId/default-answers',
  validateBody(defaultAnswersSchema),
  async (req, res, next) => {
    try {
      const version = await prisma.questionnaireVersion.findUnique({
        where: { id: req.params.versionId },
        include: { pages: { select: { id: true } } },
      });
      if (!version) throw notFound();
      const pageIds = new Set(version.pages.map((p) => p.id));

      const { answers } = req.body as z.infer<typeof defaultAnswersSchema>;
      for (const { questionId, value } of answers) {
        const question = await prisma.question.findUnique({ where: { id: questionId } });
        if (!question || !pageIds.has(question.pageId)) {
          throw badRequest('Question introuvable dans ce questionnaire.');
        }
        await prisma.question.update({
          where: { id: questionId },
          data: { defaultValue: value === null ? Prisma.JsonNull : (value as object) },
        });
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

// ── Publication d'un brouillon ───────────────────────────────────────
adminQuestionnairesRouter.post('/versions/:versionId/publish', async (req, res, next) => {
  try {
    const version = await prisma.questionnaireVersion.findUnique({
      where: { id: req.params.versionId },
      include: { pages: { include: { questions: true } } },
    });
    if (!version) throw notFound();
    if (version.status !== 'DRAFT') throw conflict('Cette version est déjà publiée.');

    const activeQuestions = version.pages
      .filter((p) => p.isActive)
      .flatMap((p) => p.questions.filter((q) => q.isActive));
    if (activeQuestions.length === 0) {
      throw badRequest('Impossible de publier un questionnaire sans question active.');
    }

    await prisma.$transaction([
      // Archive les anciennes versions publiées (les sessions existantes les gardent)
      prisma.questionnaireVersion.updateMany({
        where: { questionnaireId: version.questionnaireId, status: 'PUBLISHED' },
        data: { status: 'ARCHIVED' },
      }),
      prisma.questionnaireVersion.update({
        where: { id: version.id },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      }),
    ]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Nouveau brouillon à partir de la dernière version ────────────────
adminQuestionnairesRouter.post('/:id/draft', async (req, res, next) => {
  try {
    const questionnaire = await prisma.questionnaire.findUnique({
      where: { id: req.params.id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          include: { pages: { orderBy: { position: 'asc' }, include: { questions: { orderBy: { position: 'asc' } } } } },
        },
      },
    });
    if (!questionnaire) throw notFound();
    if (questionnaire.versions.some((v) => v.status === 'DRAFT')) {
      throw conflict('Un brouillon existe déjà pour ce questionnaire.');
    }

    const source = questionnaire.versions[0];
    const draft = await copyVersion(questionnaire.id, source, questionnaire.versions[0].version + 1);
    res.status(201).json(draft);
  } catch (err) {
    next(err);
  }
});

// ── Duplication d'un questionnaire complet ───────────────────────────
adminQuestionnairesRouter.post('/:id/duplicate', async (req, res, next) => {
  try {
    const source = await prisma.questionnaire.findUnique({
      where: { id: req.params.id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          include: { pages: { orderBy: { position: 'asc' }, include: { questions: { orderBy: { position: 'asc' } } } } },
        },
      },
    });
    if (!source) throw notFound();

    const copy = await prisma.questionnaire.create({
      data: { title: `${source.title} (copie)`, description: source.description },
    });
    await copyVersion(copy.id, source.versions[0], 1);
    res.status(201).json(copy);
  } catch (err) {
    next(err);
  }
});

// ── Suppression ──────────────────────────────────────────────────────
adminQuestionnairesRouter.delete('/:id', async (req, res, next) => {
  try {
    const sessions = await prisma.session.count({
      where: { version: { questionnaireId: req.params.id } },
    });
    if (sessions > 0) {
      throw conflict('Des sessions utilisent ce questionnaire : suppression impossible.');
    }
    await prisma.questionnaire.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

type VersionWithStructure = {
  pages: {
    title: string;
    description: string | null;
    position: number;
    isActive: boolean;
    questions: {
      type: string;
      prompt: string;
      helpText: string | null;
      position: number;
      isActive: boolean;
      required: boolean;
      config: unknown;
    }[];
  }[];
};

async function copyVersion(questionnaireId: string, source: VersionWithStructure, versionNumber: number) {
  return prisma.questionnaireVersion.create({
    data: {
      questionnaireId,
      version: versionNumber,
      status: 'DRAFT',
      pages: {
        create: source.pages.map((p) => ({
          title: p.title,
          description: p.description,
          position: p.position,
          isActive: p.isActive,
          questions: {
            create: p.questions.map((q) => ({
              type: q.type,
              prompt: q.prompt,
              helpText: q.helpText,
              position: q.position,
              isActive: q.isActive,
              required: q.required,
              config: (q.config ?? {}) as object,
            })),
          },
        })),
      },
    },
    include: { pages: { include: { questions: true } } },
  });
}
