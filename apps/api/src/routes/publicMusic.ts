import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireParticipant } from '../middleware/auth.js';
import { trackPayload } from '../services/music/payload.js';

export const publicMusicRouter = Router();

async function playlistPayload(playlistId: string | null) {
  if (!playlistId) return null;
  const playlist = await prisma.playlist.findUnique({
    where: { id: playlistId },
    include: { tracks: { orderBy: { position: 'asc' }, include: { track: true } } },
  });
  if (!playlist) return null;
  return {
    id: playlist.id,
    name: playlist.name,
    tracks: playlist.tracks.map((pt) => trackPayload(pt.track)),
  };
}

// ── Avant de rejoindre une session (page d'accueil) : playlist par défaut ──
publicMusicRouter.get('/default', async (_req, res, next) => {
  try {
    const settings = await prisma.musicSettings.findUnique({ where: { id: 'singleton' } });
    const playlist = await playlistPayload(settings?.defaultPlaylistId ?? null);
    res.json({ enabled: settings?.enabled ?? true, playlist });
  } catch (err) {
    next(err);
  }
});

// ── Pendant une session : playlist de la session ou, à défaut, la playlist par défaut ──
publicMusicRouter.get('/now', requireParticipant, async (req, res, next) => {
  try {
    const session = await prisma.session.findUniqueOrThrow({
      where: { id: req.participant!.sessionId },
    });
    const settings = await prisma.musicSettings.findUnique({ where: { id: 'singleton' } });
    const playlistId = session.playlistId ?? settings?.defaultPlaylistId ?? null;
    const playlist = await playlistPayload(playlistId);
    res.json({ enabled: settings?.enabled ?? true, playlist });
  } catch (err) {
    next(err);
  }
});
