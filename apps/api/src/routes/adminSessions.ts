import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { generatePin, hashPin, pinLookup, publicId } from '../lib/crypto.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { logEvent } from '../services/timeline.js';
import { applyDefaultAnswers } from '../services/defaultAnswers.js';
import { signToken } from '../lib/jwt.js';
import { env } from '../config/env.js';

export const adminSessionsRouter = Router();
adminSessionsRouter.use(requireAdmin);

function sessionSummary(s: {
  id: string;
  publicId: string;
  label: string | null;
  status: string;
  reportAccessEnabled: boolean;
  identityDisplay: string;
  closedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  participants: { slot: number; firstName: string; nickname: string | null; isAdmin: boolean; completedAt: Date | null }[];
  report: { code: string; score: number } | null;
  version: { version: number; questionnaire: { title: string } };
  playlist: { id: string; name: string } | null;
}) {
  return {
    id: s.id,
    publicId: s.publicId,
    label: s.label,
    status: s.status,
    reportAccessEnabled: s.reportAccessEnabled,
    identityDisplay: s.identityDisplay,
    closedAt: s.closedAt,
    expiresAt: s.expiresAt,
    createdAt: s.createdAt,
    questionnaire: `${s.version.questionnaire.title} (v${s.version.version})`,
    participants: s.participants.map((p) => ({
      slot: p.slot,
      firstName: p.firstName,
      nickname: p.nickname,
      isAdmin: p.isAdmin,
      completed: Boolean(p.completedAt),
    })),
    report: s.report ? { code: s.report.code, score: s.report.score } : null,
    playlist: s.playlist,
  };
}

const listInclude = {
  participants: { orderBy: { slot: 'asc' as const } },
  report: { select: { code: true, score: true } },
  version: { select: { version: true, questionnaire: { select: { title: true } } } },
  playlist: { select: { id: true, name: true } },
};

// ── Liste + recherche (prénom, surnom, PIN, identifiant du rapport) ──
adminSessionsRouter.get('/', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const where = q
      ? {
          OR: [
            { label: { contains: q, mode: 'insensitive' as const } },
            { participants: { some: { firstName: { contains: q, mode: 'insensitive' as const } } } },
            { participants: { some: { nickname: { contains: q, mode: 'insensitive' as const } } } },
            { report: { code: { contains: q, mode: 'insensitive' as const } } },
            ...(/^\d{6}$/.test(q) ? [{ pinLookup: pinLookup(q) }] : []),
          ],
        }
      : {};
    const sessions = await prisma.session.findMany({
      where,
      include: listInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(sessions.map(sessionSummary));
  } catch (err) {
    next(err);
  }
});

// ── Création : PIN 6 chiffres + lien d'invitation ────────────────────
const identityDisplaySchema = z.enum(['FIRST_NAME', 'NICKNAME', 'BOTH', 'NONE']);

const createSchema = z.object({
  label: z.string().trim().max(120).optional(),
  questionnaireId: z.string().optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  identityDisplay: identityDisplaySchema.default('BOTH'),
  playlistId: z.string().nullable().optional(),
});

adminSessionsRouter.post('/', validateBody(createSchema), async (req, res, next) => {
  try {
    const { label, questionnaireId, expiresInDays, identityDisplay, playlistId } = req.body;

    const version = await prisma.questionnaireVersion.findFirst({
      where: { status: 'PUBLISHED', ...(questionnaireId ? { questionnaireId } : {}) },
      orderBy: [{ publishedAt: 'desc' }],
    });
    if (!version) throw badRequest('Aucun questionnaire publié. Publie une version d’abord.');

    if (playlistId) {
      const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
      if (!playlist) throw badRequest('Playlist introuvable.');
    }

    // Génère un PIN unique (l'unicité de pinLookup est garantie en base)
    let pin = generatePin();
    for (let i = 0; i < 10; i += 1) {
      const clash = await prisma.session.findUnique({ where: { pinLookup: pinLookup(pin) } });
      if (!clash) break;
      pin = generatePin();
    }

    const session = await prisma.session.create({
      data: {
        publicId: publicId(),
        label: label || null,
        pinHash: await hashPin(pin),
        pinLookup: pinLookup(pin),
        versionId: version.id,
        identityDisplay,
        playlistId: playlistId || null,
        expiresAt: expiresInDays
          ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
          : null,
      },
    });
    await logEvent(session.id, 'session.created', 'Session créée');
    await logEvent(session.id, 'pin.generated', 'PIN à 6 chiffres généré');

    const inviteUrl = `${env.WEB_ORIGIN}/join/${pin}`;
    res.status(201).json({
      id: session.id,
      pin, // affiché une seule fois : seul le hash est stocké
      inviteUrl,
      inviteMessage: `Découvre notre compatibilité sur Compatilo 💜\n${inviteUrl}\nCode PIN : ${pin}`,
    });
  } catch (err) {
    next(err);
  }
});

// ── L'admin rejoint sa propre session comme second (ou premier)
// participant, pour répondre en même temps que son invité·e ────────────
const joinAsAdminSchema = z.object({
  firstName: z.string().trim().min(3).max(60),
  nickname: z.string().trim().min(3).max(60).optional(),
});

adminSessionsRouter.post('/:id/join', validateBody(joinAsAdminSchema), async (req, res, next) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: { participants: { orderBy: { slot: 'asc' } } },
    });
    if (!session) throw notFound();
    if (session.status === 'CLOSED') {
      throw forbidden('Cette session est fermée : aucune modification n’est plus possible.');
    }

    // Idempotent : si l'admin a déjà rejoint, on renvoie simplement un
    // nouveau jeton pour reprendre là où il/elle en était.
    let participant = session.participants.find((p) => p.isAdmin);
    if (!participant) {
      if (session.participants.length >= 2) {
        throw conflict('Cette session est déjà complète (deux participants).');
      }
      const nextSlot = session.participants.some((p) => p.slot === 1) ? 2 : 1;
      participant = await prisma.participant.create({
        data: {
          sessionId: session.id,
          slot: nextSlot,
          isAdmin: true,
          firstName: req.body.firstName,
          nickname: req.body.nickname || null,
        },
      });
      await logEvent(
        session.id,
        'participant.joined',
        `${req.body.firstName} (administrateur·rice) a rejoint la session`,
        { slot: nextSlot },
      );
      await applyDefaultAnswers(participant.id, session.versionId);
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
        completed: Boolean(participant.completedAt),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── Détail complet (GPS inclus — réservé admin) ──────────────────────
adminSessionsRouter.get('/:id', async (req, res, next) => {
  try {
    const s = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: {
        ...listInclude,
        participants: {
          orderBy: { slot: 'asc' },
          include: { answers: { select: { id: true } }, favorites: { select: { questionId: true } } },
        },
        report: { include: { signatures: true } },
        version: {
          include: {
            questionnaire: { select: { title: true } },
            pages: {
              where: { isActive: true },
              include: { questions: { where: { isActive: true }, select: { id: true } } },
            },
          },
        },
      },
    });
    if (!s) throw notFound();

    const totalQuestions = s.version.pages.reduce((n, p) => n + p.questions.length, 0);
    res.json({
      id: s.id,
      publicId: s.publicId,
      label: s.label,
      status: s.status,
      reportAccessEnabled: s.reportAccessEnabled,
      identityDisplay: s.identityDisplay,
      closedAt: s.closedAt,
      playlist: s.playlist,
      expiresAt: s.expiresAt,
      privateNotes: s.privateNotes,
      createdAt: s.createdAt,
      questionnaire: `${s.version.questionnaire.title} (v${s.version.version})`,
      totalQuestions,
      participants: s.participants.map((p) => ({
        id: p.id,
        slot: p.slot,
        firstName: p.firstName,
        nickname: p.nickname,
        isAdmin: p.isAdmin,
        joinedAt: p.joinedAt,
        startedAt: p.startedAt,
        completedAt: p.completedAt,
        answeredCount: p.answers.length,
        favoritesCount: p.favorites.length,
        locationConsent: p.locationConsent,
        city: p.city,
        latitude: p.latitude,
        longitude: p.longitude,
      })),
      report: s.report
        ? {
            code: s.report.code,
            score: s.report.score,
            generatedAt: s.report.generatedAt,
            data: s.report.data,
            signatures: s.report.signatures.map((sig) => ({
              participantId: sig.participantId,
              image: sig.image,
              signedAt: sig.signedAt,
            })),
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

// ── Récap des réponses d'un participant (consultation admin) ─────────
adminSessionsRouter.get('/:id/participants/:participantId/answers', async (req, res, next) => {
  try {
    const participant = await prisma.participant.findUnique({
      where: { id: req.params.participantId },
      include: { answers: true, favorites: { select: { questionId: true } } },
    });
    if (!participant || participant.sessionId !== req.params.id) throw notFound();

    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      select: {
        version: {
          select: {
            pages: {
              where: { isActive: true },
              orderBy: { position: 'asc' },
              select: {
                id: true,
                title: true,
                questions: {
                  where: { isActive: true },
                  orderBy: { position: 'asc' },
                  select: { id: true, type: true, prompt: true, required: true },
                },
              },
            },
          },
        },
      },
    });
    if (!session) throw notFound();

    const answerByQuestion = new Map(participant.answers.map((a) => [a.questionId, a.value]));
    const favoriteIds = new Set(participant.favorites.map((f) => f.questionId));

    res.json({
      firstName: participant.firstName,
      pages: session.version.pages.map((p) => ({
        title: p.title,
        questions: p.questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          required: q.required,
          value: answerByQuestion.get(q.id) ?? null,
          isFavorite: favoriteIds.has(q.id),
        })),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ── Mise à jour : notes privées, accès rapport, libellé, expiration ──
const patchSchema = z.object({
  label: z.string().trim().max(120).nullable().optional(),
  privateNotes: z.string().max(10_000).nullable().optional(),
  reportAccessEnabled: z.boolean().optional(),
  identityDisplay: identityDisplaySchema.optional(),
  playlistId: z.string().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

adminSessionsRouter.patch('/:id', validateBody(patchSchema), async (req, res, next) => {
  try {
    const existing = await prisma.session.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound();

    const { label, privateNotes, reportAccessEnabled, identityDisplay, playlistId, expiresAt } =
      req.body;

    if (playlistId) {
      const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
      if (!playlist) throw badRequest('Playlist introuvable.');
    }

    const session = await prisma.session.update({
      where: { id: req.params.id },
      data: {
        ...(label !== undefined ? { label } : {}),
        ...(privateNotes !== undefined ? { privateNotes } : {}),
        ...(reportAccessEnabled !== undefined ? { reportAccessEnabled } : {}),
        ...(identityDisplay !== undefined ? { identityDisplay } : {}),
        ...(playlistId !== undefined ? { playlistId: playlistId || null } : {}),
        ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
      },
    });

    if (reportAccessEnabled !== undefined && reportAccessEnabled !== existing.reportAccessEnabled) {
      await logEvent(
        session.id,
        reportAccessEnabled ? 'access.enabled' : 'access.disabled',
        reportAccessEnabled ? 'Accès au rapport activé' : 'Accès au rapport désactivé',
      );
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Invitation copiée (événement timeline) ───────────────────────────
adminSessionsRouter.post('/:id/invite-copied', async (req, res, next) => {
  try {
    await logEvent(req.params.id, 'invite.copied', "Message d'invitation copié");
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Timeline ─────────────────────────────────────────────────────────
adminSessionsRouter.get('/:id/timeline', async (req, res, next) => {
  try {
    const events = await prisma.timelineEvent.findMany({
      where: { sessionId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    res.json(events);
  } catch (err) {
    next(err);
  }
});

// ── Fermeture : verrouille définitivement la session ──────────────────
// Plus de réponses, favoris, signatures ni nouveaux participants ; le
// rapport (s'il existe) est figé. Indépendant de `reportAccessEnabled`,
// qui ne gouverne que la lecture du rapport par l'invité.
adminSessionsRouter.post('/:id/close', async (req, res, next) => {
  try {
    const existing = await prisma.session.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound();
    if (existing.status === 'CLOSED') {
      res.json({ ok: true });
      return;
    }
    await prisma.session.update({
      where: { id: req.params.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
    await logEvent(req.params.id, 'session.closed', 'Session fermée par l’administrateur');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Réouverture ─────────────────────────────────────────────────────
adminSessionsRouter.post('/:id/reopen', async (req, res, next) => {
  try {
    const existing = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: { report: { select: { id: true } } },
    });
    if (!existing) throw notFound();
    if (existing.status !== 'CLOSED') {
      res.json({ ok: true });
      return;
    }
    await prisma.session.update({
      where: { id: req.params.id },
      data: { status: existing.report ? 'COMPLETED' : 'ACTIVE', closedAt: null },
    });
    await logEvent(req.params.id, 'session.reopened', 'Session rouverte par l’administrateur');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Suppression ──────────────────────────────────────────────────────
adminSessionsRouter.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.session.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound();
    await prisma.session.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
