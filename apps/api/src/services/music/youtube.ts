/**
 * Métadonnées YouTube via l'API oEmbed officielle (titre + miniature) —
 * aucun contournement des restrictions de la plateforme, aucune
 * extraction de flux. La lecture se fait via le lecteur IFrame officiel
 * côté client (voir apps/web/src/music/providers/YouTubeProvider.ts).
 */

export interface YoutubeMetadata {
  videoId: string;
  title: string;
  thumbnailUrl: string;
}

const ID_PATTERNS = [
  /youtu\.be\/([\w-]{11})/,
  /[?&]v=([\w-]{11})/,
  /youtube\.com\/shorts\/([\w-]{11})/,
  /youtube\.com\/embed\/([\w-]{11})/,
];

export function extractYoutubeVideoId(url: string): string | null {
  for (const pattern of ID_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function fetchYoutubeMetadata(url: string): Promise<YoutubeMetadata> {
  const videoId = extractYoutubeVideoId(url);
  if (!videoId) throw new Error('Lien YouTube invalide.');

  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`,
  )}&format=json`;

  const res = await fetch(oembedUrl);
  if (!res.ok) {
    throw new Error('Vidéo introuvable ou non intégrable (privée, restreinte, ou supprimée).');
  }
  const data = (await res.json()) as { title?: string; thumbnail_url?: string };
  if (!data.title) throw new Error('Réponse YouTube invalide.');

  return { videoId, title: data.title, thumbnailUrl: data.thumbnail_url ?? '' };
}
