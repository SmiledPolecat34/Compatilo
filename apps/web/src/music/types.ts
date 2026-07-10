export type TrackType = 'LOCAL' | 'YOUTUBE';

export interface Track {
  id: string;
  type: TrackType;
  title: string;
  artist: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  fileUrl: string | null; // LOCAL
  youtubeVideoId: string | null; // YOUTUBE
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
}

export interface MusicStateResponse {
  enabled: boolean;
  playlist: Playlist | null;
}

export type RepeatMode = 'off' | 'all' | 'one';

/** Un provider sait jouer un seul type de piste (Local, YouTube, demain Spotify...). */
export interface PlaybackProvider {
  load(track: Track): void;
  play(): Promise<void> | void;
  pause(): void;
  seek(seconds: number): void;
  setVolume(volume: number): void; // 0..1
  setMuted(muted: boolean): void;
  destroy(): void;
}

export interface PlaybackCallbacks {
  onTimeUpdate: (seconds: number) => void;
  onDurationChange: (seconds: number) => void;
  onEnded: () => void;
  onError?: (message: string) => void;
}
