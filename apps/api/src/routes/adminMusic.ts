import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { badRequest, notFound } from '../lib/errors.js';
import { requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { env } from '../config/env.js';
import { storage } from '../services/music/storage.js';
import { fetchYoutubeMetadata } from '../services/music/youtube.js';
import { trackPayload } from '../services/music/payload.js';

export const adminMusicRouter = Router();
adminMusicRouter.use(requireAdmin);

const ALLOWED_MIME = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/ogg',
  'application/ogg',
]);
const ALLOWED_EXT = new Set(['.mp3', '.wav', '.ogg']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MUSIC_MAX_FILE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = (file.originalname.match(/\.[^.]+$/)?.[0] ?? '').toLowerCase();
    if (!ALLOWED_MIME.has(file.mimetype) && !ALLOWED_EXT.has(ext)) {
      cb(new Error('Formats acceptés : MP3, WAV, OGG.'));
      return;
    }
    cb(null, true);
  },
});

function handleUpload(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) {
      next(badRequest(err instanceof Error ? err.message : 'Fichier invalide.'));
      return;
    }
    next();
  });
}

async function getSettings() {
  return prisma.musicSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
}

// ── Réglages globaux ───────────────────────────────────────────────────
adminMusicRouter.get('/settings', async (_req, res, next) => {
  try {
    res.json(await getSettings());
  } catch (err) {
    next(err);
  }
});

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  defaultPlaylistId: z.string().nullable().optional(),
});

adminMusicRouter.patch('/settings', validateBody(settingsSchema), async (req, res, next) => {
  try {
    const { enabled, defaultPlaylistId } = req.body;
    if (defaultPlaylistId) {
      const playlist = await prisma.playlist.findUnique({ where: { id: defaultPlaylistId } });
      if (!playlist) throw badRequest('Playlist introuvable.');
    }
    await getSettings();
    const settings = await prisma.musicSettings.update({
      where: { id: 'singleton' },
      data: {
        ...(enabled !== undefined ? { enabled } : {}),
        ...(defaultPlaylistId !== undefined ? { defaultPlaylistId } : {}),
      },
    });
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// ── Playlists ────────────────────────────────────────────────────────
adminMusicRouter.get('/playlists', async (_req, res, next) => {
  try {
    const playlists = await prisma.playlist.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { tracks: true } } },
    });
    res.json(playlists.map((p) => ({ id: p.id, name: p.name, isDefault: p.isDefault, trackCount: p._count.tracks })));
  } catch (err) {
    next(err);
  }
});

const createPlaylistSchema = z.object({ name: z.string().trim().min(1).max(120) });

adminMusicRouter.post('/playlists', validateBody(createPlaylistSchema), async (req, res, next) => {
  try {
    const playlist = await prisma.playlist.create({ data: { name: req.body.name } });
    res.status(201).json(playlist);
  } catch (err) {
    next(err);
  }
});

adminMusicRouter.get('/playlists/:id', async (req, res, next) => {
  try {
    const playlist = await prisma.playlist.findUnique({
      where: { id: req.params.id },
      include: { tracks: { orderBy: { position: 'asc' }, include: { track: true } } },
    });
    if (!playlist) throw notFound();
    res.json({
      id: playlist.id,
      name: playlist.name,
      isDefault: playlist.isDefault,
      tracks: playlist.tracks.map((pt) => trackPayload(pt.track)),
    });
  } catch (err) {
    next(err);
  }
});

const patchPlaylistSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  isDefault: z.boolean().optional(),
});

adminMusicRouter.patch('/playlists/:id', validateBody(patchPlaylistSchema), async (req, res, next) => {
  try {
    const existing = await prisma.playlist.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound();
    const { name, isDefault } = req.body;

    await prisma.$transaction(async (tx) => {
      if (name !== undefined) {
        await tx.playlist.update({ where: { id: existing.id }, data: { name } });
      }
      if (isDefault) {
        await tx.playlist.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
        await tx.playlist.update({ where: { id: existing.id }, data: { isDefault: true } });
        await tx.musicSettings.upsert({
          where: { id: 'singleton' },
          update: { defaultPlaylistId: existing.id },
          create: { id: 'singleton', defaultPlaylistId: existing.id },
        });
      } else if (isDefault === false) {
        await tx.playlist.update({ where: { id: existing.id }, data: { isDefault: false } });
      }
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminMusicRouter.delete('/playlists/:id', async (req, res, next) => {
  try {
    const playlist = await prisma.playlist.findUnique({
      where: { id: req.params.id },
      include: { tracks: { include: { track: true } } },
    });
    if (!playlist) throw notFound();

    await prisma.$transaction(async (tx) => {
      await tx.musicSettings.updateMany({
        where: { defaultPlaylistId: playlist.id },
        data: { defaultPlaylistId: null },
      });
      await tx.playlist.delete({ where: { id: playlist.id } });
    });

    // Nettoyage best-effort des pistes orphelines (et de leurs fichiers)
    for (const pt of playlist.tracks) {
      const stillUsed = await prisma.playlistTrack.count({ where: { trackId: pt.trackId } });
      if (stillUsed === 0) {
        if (pt.track.type === 'LOCAL' && pt.track.fileKey) await storage.remove(pt.track.fileKey);
        await prisma.track.delete({ where: { id: pt.trackId } });
      }
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

async function appendTrack(playlistId: string, trackId: string) {
  const last = await prisma.playlistTrack.findFirst({
    where: { playlistId },
    orderBy: { position: 'desc' },
  });
  await prisma.playlistTrack.create({
    data: { playlistId, trackId, position: (last?.position ?? -1) + 1 },
  });
}

// ── Mode 1 : upload de fichier (MP3 / WAV / OGG) ──────────────────────
adminMusicRouter.post('/playlists/:id/tracks/upload', handleUpload, async (req, res, next) => {
  try {
    const playlist = await prisma.playlist.findUnique({ where: { id: req.params.id } });
    if (!playlist) throw notFound();
    const file = req.file;
    if (!file) throw badRequest('Aucun fichier reçu.');

    const stored = await storage.save(file.buffer, file.originalname);
    const title =
      (typeof req.body?.title === 'string' && req.body.title.trim()) ||
      file.originalname.replace(/\.[^.]+$/, '');

    const track = await prisma.track.create({
      data: {
        type: 'LOCAL',
        title,
        artist: typeof req.body?.artist === 'string' ? req.body.artist.trim() || null : null,
        fileKey: stored.key,
      },
    });
    await appendTrack(playlist.id, track.id);
    res.status(201).json(trackPayload(track));
  } catch (err) {
    next(err);
  }
});

// ── Mode 2 : vidéo YouTube (titre + miniature récupérés automatiquement) ──
const youtubeSchema = z.object({ url: z.string().url() });

adminMusicRouter.post(
  '/playlists/:id/tracks/youtube',
  validateBody(youtubeSchema),
  async (req, res, next) => {
    try {
      const playlist = await prisma.playlist.findUnique({ where: { id: req.params.id } });
      if (!playlist) throw notFound();

      let meta;
      try {
        meta = await fetchYoutubeMetadata(req.body.url);
      } catch (err) {
        throw badRequest(err instanceof Error ? err.message : 'Vidéo YouTube invalide.');
      }

      const track = await prisma.track.create({
        data: {
          type: 'YOUTUBE',
          title: meta.title,
          youtubeVideoId: meta.videoId,
          thumbnailUrl: meta.thumbnailUrl,
        },
      });
      await appendTrack(playlist.id, track.id);
      res.status(201).json(trackPayload(track));
    } catch (err) {
      next(err);
    }
  },
);

// ── Réordonnancement (glisser-déposer) ────────────────────────────────
const orderSchema = z.object({ trackIds: z.array(z.string().min(1)) });

adminMusicRouter.put('/playlists/:id/tracks/order', validateBody(orderSchema), async (req, res, next) => {
  try {
    const playlist = await prisma.playlist.findUnique({
      where: { id: req.params.id },
      include: { tracks: true },
    });
    if (!playlist) throw notFound();

    const current = new Set(playlist.tracks.map((t) => t.trackId));
    const incoming: string[] = req.body.trackIds;
    if (incoming.length !== current.size || incoming.some((id) => !current.has(id))) {
      throw badRequest('La liste ne correspond pas aux pistes de la playlist.');
    }

    await prisma.$transaction(
      incoming.map((trackId, position) =>
        prisma.playlistTrack.update({
          where: { playlistId_trackId: { playlistId: playlist.id, trackId } },
          data: { position },
        }),
      ),
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Retirer une piste d'une playlist ──────────────────────────────────
adminMusicRouter.delete('/playlists/:id/tracks/:trackId', async (req, res, next) => {
  try {
    const link = await prisma.playlistTrack.findUnique({
      where: { playlistId_trackId: { playlistId: req.params.id, trackId: req.params.trackId } },
      include: { track: true },
    });
    if (!link) throw notFound();

    await prisma.playlistTrack.delete({ where: { id: link.id } });

    const stillUsed = await prisma.playlistTrack.count({ where: { trackId: link.trackId } });
    if (stillUsed === 0) {
      if (link.track.type === 'LOCAL' && link.track.fileKey) await storage.remove(link.track.fileKey);
      await prisma.track.delete({ where: { id: link.trackId } });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
