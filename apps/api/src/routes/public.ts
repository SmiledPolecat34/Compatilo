import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { pinLookup, verifyPin } from '../lib/crypto.js';
import { signToken } from '../lib/jwt.js';
import { badRequest, forbidden, notFound, tooMany } from '../lib/errors.js';
import { requireParticipant } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { logEvent } from '../services/timeline.js';
import { applyIdentityDisplay, generateReport, type ReportData } from '../services/report.js';
import { isTrilean } from '../domain/compatibility.js';
import { computeDisplayName, type IdentityDisplayMode } from '../domain/identity.js';

export const publicRouter = Router();

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const FAVORITES_MIN = 3;
const FAVORITES_MAX = 5;

// Limitation par IP en plus du verrouillage par session
const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessaie dans quelques minutes.' },
});

const pinSchema = z.object({ pin: z.string().regex(/^\d{6}$/, 'PIN à 6 chiffres attendu') });

async function findSessionByPin(pin: string) {
  const session = await prisma.session.findUnique({
    where: { pinLookup: pinLookup(pin) },
    include: { participants: { orderBy: { slot: 'asc' } } },
  });
  if (!session || session.status === 'ARCHIVED') throw notFound('Code PIN invalide.');
  if (session.lockedUntil && session.lockedUntil > new Date()) {
    throw tooMany('Trop de tentatives. Cette session est temporairement verrouillée.');
  }
  if (session.expiresAt && session.expiresAt < new Date()) {
    throw forbidden('Cette session a expiré.');
  }
  const ok = await verifyPin(pin, session.pinHash);
  if (!ok) {
    // Collision HMAC improbable mais on applique quand même le compteur
    const attempts = session.failedAttempts + 1;
    await prisma.session.update({
      where: { id: session.id },
      data: {
        failedAttempts: attempts,
        lockedUntil:
          attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    throw notFound('Code PIN invalide.');
  }
  if (session.failedAttempts > 0) {
    await prisma.session.update({
      where: { id: session.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });
  }
  return session;
}

// ── Vérifier un PIN et découvrir la session ──────────────────────────
publicRouter.post('/join/check', pinLimiter, validateBody(pinSchema), async (req, res, next) => {
  try {
    const session = await findSessionByPin(req.body.pin);
    const mode = session.identityDisplay as IdentityDisplayMode;
    res.json({
      label: session.label,
      completed: session.status === 'COMPLETED',
      reportAccessEnabled: session.reportAccessEnabled,
      participants: session.participants.map((p) => ({
        slot: p.slot,
        firstName: computeDisplayName(mode, p.firstName, p.nickname, p.slot),
        nickname: null,
        completed: Boolean(p.completedAt),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ── Rejoindre : nouveau participant ou reprise d'un existant ─────────
const enterSchema = pinSchema.extend({
  slot: z.number().int().min(1).max(2).optional(),
  firstName: z.string().trim().min(1).max(60).optional(),
  nickname: z.string().trim().max(60).optional(),
  locationConsent: z.boolean().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  city: z.string().trim().max(120).optional(),
});

publicRouter.post('/join/enter', pinLimiter, validateBody(enterSchema), async (req, res, next) => {
  try {
    const session = await findSessionByPin(req.body.pin);
    const { slot, firstName, nickname, locationConsent, latitude, longitude, city } = req.body;

    let participant;
    if (slot) {
      // Reprise d'un participant existant
      participant = session.participants.find((p) => p.slot === slot);
      if (!participant) throw notFound('Participant introuvable.');
      await logEvent(session.id, 'participant.resumed', `${participant.firstName} est revenu·e`);
    } else {
      if (!firstName) throw badRequest('Le prénom est requis.');
      if (session.participants.length >= 2) {
        throw forbidden('Cette session est déjà complète (deux participants).');
      }
      const nextSlot = session.participants.some((p) => p.slot === 1) ? 2 : 1;
      participant = await prisma.participant.create({
        data: {
          sessionId: session.id,
          slot: nextSlot,
          firstName,
          nickname: nickname || null,
          locationConsent: Boolean(locationConsent),
          latitude: locationConsent ? (latitude ?? null) : null,
          longitude: locationConsent ? (longitude ?? null) : null,
          city: locationConsent ? (city ?? null) : null,
        },
      });
      await logEvent(session.id, 'participant.joined', `${firstName} a rejoint la session`, {
        slot: nextSlot,
      });
    }

    const token = signToken(
      { kind: 'participant', participantId: participant.id, sessionId: session.id },
      '7d',
    );
    res.json({
      token,
      participant: {
        id: participant.id,
        slot: participant.slot,
        firstName: participant.firstName,
        nickname: participant.nickname,
        completed: Boolean(participant.completedAt),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── Questionnaire + état du participant ──────────────────────────────
publicRouter.get('/me/questionnaire', requireParticipant, async (req, res, next) => {
  try {
    const { participantId, sessionId } = req.participant!;
    const [participant, session] = await Promise.all([
      prisma.participant.findUniqueOrThrow({
        where: { id: participantId },
        include: { answers: true, favorites: true },
      }),
      prisma.session.findUniqueOrThrow({
        where: { id: sessionId },
        include: {
          version: {
            include: {
              questionnaire: { select: { title: true, description: true } },
              pages: {
                where: { isActive: true },
                orderBy: { position: 'asc' },
                include: {
                  questions: { where: { isActive: true }, orderBy: { position: 'asc' } },
                },
              },
            },
          },
        },
      }),
    ]);

    if (!participant.startedAt) {
      await prisma.participant.update({
        where: { id: participantId },
        data: { startedAt: new Date() },
      });
      await logEvent(sessionId, 'questionnaire.started', `${participant.firstName} a commencé le questionnaire`);
    }

    res.json({
      questionnaire: {
        title: session.version.questionnaire.title,
        description: session.version.questionnaire.description,
        pages: session.version.pages.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          questions: p.questions.map((q) => ({
            id: q.id,
            type: q.type,
            prompt: q.prompt,
            helpText: q.helpText,
            required: q.required,
            config: q.config,
          })),
        })),
      },
      participant: {
        firstName: participant.firstName,
        slot: participant.slot,
        completed: Boolean(participant.completedAt),
      },
      answers: Object.fromEntries(participant.answers.map((a) => [a.questionId, a.value])),
      favorites: participant.favorites.map((f) => f.questionId),
      favoritesRule: { min: FAVORITES_MIN, max: FAVORITES_MAX },
    });
  } catch (err) {
    next(err);
  }
});

// ── Sauvegarde automatique d'une réponse ─────────────────────────────
const answerSchema = z.object({ value: z.enum(['YES', 'POSSIBLE', 'NO']) });

publicRouter.put(
  '/me/answers/:questionId',
  requireParticipant,
  validateBody(answerSchema),
  async (req, res, next) => {
    try {
      const { participantId, sessionId } = req.participant!;
      const { questionId } = req.params;
      const { value } = req.body;

      const participant = await prisma.participant.findUniqueOrThrow({
        where: { id: participantId },
      });
      if (participant.completedAt) throw forbidden('Le questionnaire est déjà terminé.');

      // La question doit appartenir au questionnaire de la session
      const question = await prisma.question.findFirst({
        where: {
          id: questionId,
          isActive: true,
          page: { isActive: true, version: { sessions: { some: { id: sessionId } } } },
        },
      });
      if (!question) throw notFound('Question introuvable.');
      if (!isTrilean(value)) throw badRequest('Valeur de réponse invalide.');

      await prisma.answer.upsert({
        where: { participantId_questionId: { participantId, questionId } },
        create: { participantId, questionId, value },
        update: { value },
      });
      await logEvent(sessionId, 'answer.saved', `${participant.firstName} a enregistré une réponse`, {
        questionId,
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

// ── Favoris (3 à 5) ──────────────────────────────────────────────────
const favoritesSchema = z.object({
  questionIds: z.array(z.string().min(1)).max(FAVORITES_MAX),
});

publicRouter.put(
  '/me/favorites',
  requireParticipant,
  validateBody(favoritesSchema),
  async (req, res, next) => {
    try {
      const { participantId, sessionId } = req.participant!;
      const ids: string[] = [...new Set(req.body.questionIds as string[])];

      const valid = await prisma.question.count({
        where: {
          id: { in: ids },
          page: { version: { sessions: { some: { id: sessionId } } } },
        },
      });
      if (valid !== ids.length) throw badRequest('Certaines questions sont invalides.');

      await prisma.$transaction([
        prisma.favorite.deleteMany({ where: { participantId, questionId: { notIn: ids } } }),
        ...ids.map((questionId) =>
          prisma.favorite.upsert({
            where: { participantId_questionId: { participantId, questionId } },
            create: { participantId, questionId },
            update: {},
          }),
        ),
      ]);
      res.json({ ok: true, count: ids.length });
    } catch (err) {
      next(err);
    }
  },
);

// ── Terminer le questionnaire ────────────────────────────────────────
publicRouter.post('/me/complete', requireParticipant, async (req, res, next) => {
  try {
    const { participantId, sessionId } = req.participant!;
    const participant = await prisma.participant.findUniqueOrThrow({
      where: { id: participantId },
      include: { answers: true, favorites: true },
    });
    if (participant.completedAt) {
      res.json({ ok: true, alreadyCompleted: true });
      return;
    }

    const requiredQuestions = await prisma.question.findMany({
      where: {
        required: true,
        isActive: true,
        page: { isActive: true, version: { sessions: { some: { id: sessionId } } } },
      },
      select: { id: true },
    });
    const answered = new Set(participant.answers.map((a) => a.questionId));
    const missing = requiredQuestions.filter((q) => !answered.has(q.id));
    if (missing.length > 0) {
      throw badRequest(`Il reste ${missing.length} question(s) sans réponse.`, 'INCOMPLETE');
    }
    if (participant.favorites.length < FAVORITES_MIN) {
      throw badRequest(
        `Sélectionne au moins ${FAVORITES_MIN} favoris avant de terminer.`,
        'FAVORITES',
      );
    }

    await prisma.participant.update({
      where: { id: participantId },
      data: { completedAt: new Date() },
    });
    await logEvent(sessionId, 'questionnaire.completed', `${participant.firstName} a terminé le questionnaire`);

    const report = await generateReport(sessionId);
    res.json({ ok: true, reportReady: Boolean(report) });
  } catch (err) {
    next(err);
  }
});

// ── Rapport ──────────────────────────────────────────────────────────
publicRouter.get('/me/report', requireParticipant, async (req, res, next) => {
  try {
    const { sessionId, participantId } = req.participant!;
    const session = await prisma.session.findUniqueOrThrow({
      where: { id: sessionId },
      include: {
        report: { include: { signatures: true } },
        participants: { orderBy: { slot: 'asc' } },
      },
    });
    const mode = session.identityDisplay as IdentityDisplayMode;
    if (!session.report) {
      res.json({
        ready: false,
        waitingFor: session.participants
          .filter((p) => !p.completedAt)
          .map((p) => computeDisplayName(mode, p.firstName, p.nickname, p.slot)),
      });
      return;
    }
    if (!session.reportAccessEnabled) {
      throw forbidden("L'accès au rapport a été désactivé.");
    }
    res.json({
      ready: true,
      report: {
        code: session.report.code,
        score: session.report.score,
        generatedAt: session.report.generatedAt,
        data: applyIdentityDisplay(session.report.data as unknown as ReportData, mode),
        signatures: session.report.signatures.map((s) => ({
          participantId: s.participantId,
          image: s.image,
          signedAt: s.signedAt,
        })),
        myParticipantId: participantId,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── Signature ────────────────────────────────────────────────────────
const signatureSchema = z.object({
  image: z
    .string()
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, 'Signature invalide')
    .max(300_000),
});

publicRouter.post(
  '/me/report/signature',
  requireParticipant,
  validateBody(signatureSchema),
  async (req, res, next) => {
    try {
      const { sessionId, participantId } = req.participant!;
      const report = await prisma.report.findUnique({ where: { sessionId } });
      if (!report) throw notFound("Le rapport n'est pas encore disponible.");

      const participant = await prisma.participant.findUniqueOrThrow({
        where: { id: participantId },
      });
      await prisma.signature.upsert({
        where: { reportId_participantId: { reportId: report.id, participantId } },
        create: { reportId: report.id, participantId, image: req.body.image },
        update: { image: req.body.image, signedAt: new Date() },
      });
      await logEvent(sessionId, 'signature.saved', `${participant.firstName} a signé le rapport`);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);
