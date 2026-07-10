import type { Track } from '@prisma/client';

export function trackPayload(t: Track) {
  return {
    id: t.id,
    type: t.type,
    title: t.title,
    artist: t.artist,
    durationSeconds: t.durationSeconds,
    thumbnailUrl: t.thumbnailUrl,
    fileUrl: t.type === 'LOCAL' && t.fileKey ? `/uploads/audio/${t.fileKey}` : null,
    youtubeVideoId: t.type === 'YOUTUBE' ? t.youtubeVideoId : null,
  };
}
