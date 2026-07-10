import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middleware/auth.js';

export const adminStatsRouter = Router();
adminStatsRouter.use(requireAdmin);

adminStatsRouter.get('/', async (_req, res, next) => {
  try {
    const [
      totalSessions,
      activeSessions,
      completedSessions,
      archivedSessions,
      totalParticipants,
      completedParticipants,
      totalReports,
      scoreAgg,
      totalQuestionnaires,
      publishedVersions,
      totalPlaylists,
      totalTracks,
    ] = await Promise.all([
      prisma.session.count(),
      prisma.session.count({ where: { status: 'ACTIVE' } }),
      prisma.session.count({ where: { status: 'COMPLETED' } }),
      prisma.session.count({ where: { status: 'ARCHIVED' } }),
      prisma.participant.count(),
      prisma.participant.count({ where: { completedAt: { not: null } } }),
      prisma.report.count(),
      prisma.report.aggregate({ _avg: { score: true } }),
      prisma.questionnaire.count(),
      prisma.questionnaireVersion.count({ where: { status: 'PUBLISHED' } }),
      prisma.playlist.count(),
      prisma.track.count(),
    ]);

    res.json({
      sessions: {
        total: totalSessions,
        active: activeSessions,
        completed: completedSessions,
        archived: archivedSessions,
      },
      participants: { total: totalParticipants, completed: completedParticipants },
      reports: {
        total: totalReports,
        averageScore: scoreAgg._avg.score !== null ? Math.round(scoreAgg._avg.score) : null,
      },
      questionnaires: { total: totalQuestionnaires, publishedVersions },
      music: { playlists: totalPlaylists, tracks: totalTracks },
    });
  } catch (err) {
    next(err);
  }
});
