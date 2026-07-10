import type { PlaybackCallbacks, PlaybackProvider, Track } from '../types';
import { loadYouTubeApi } from './youtubeLoader';

/**
 * Lit les pistes YOUTUBE via le lecteur IFrame officiel — aucune extraction
 * de flux, aucun contournement des restrictions de la plateforme. Le
 * lecteur reste visible (petite vignette) dans la barre de lecture,
 * conformément à l'usage prévu par YouTube pour les intégrations.
 */
export class YouTubeProvider implements PlaybackProvider {
  private player: YT.Player | null = null;
  private readonly ready: Promise<void>;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pendingVideoId: string | null = null;

  constructor(
    container: HTMLElement,
    private readonly callbacks: PlaybackCallbacks,
  ) {
    this.ready = loadYouTubeApi().then(
      (YTApi) =>
        new Promise<void>((resolve) => {
          this.player = new YTApi.Player(container, {
            width: '100%',
            height: '100%',
            playerVars: { playsinline: 1, controls: 1, modestbranding: 1, rel: 0 },
            events: {
              onReady: () => {
                if (this.pendingVideoId) this.player?.cueVideoById(this.pendingVideoId);
                resolve();
              },
              onStateChange: (event) => {
                if (event.data === YTApi.PlayerState.ENDED) {
                  this.stopPolling();
                  callbacks.onEnded();
                } else if (event.data === YTApi.PlayerState.PLAYING) {
                  callbacks.onDurationChange(this.player?.getDuration() ?? 0);
                  this.startPolling();
                } else {
                  this.stopPolling();
                }
              },
              onError: () => callbacks.onError?.('Cette vidéo YouTube ne peut pas être lue.'),
            },
          });
        }),
    );
  }

  private startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      if (this.player) this.callbacks.onTimeUpdate(this.player.getCurrentTime());
    }, 500);
  }

  private stopPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  load(track: Track): void {
    if (!track.youtubeVideoId) return;
    this.pendingVideoId = track.youtubeVideoId;
    void this.ready.then(() => this.player?.cueVideoById(track.youtubeVideoId!));
  }

  async play() {
    await this.ready;
    this.player?.playVideo();
  }

  pause(): void {
    this.player?.pauseVideo();
  }

  seek(seconds: number): void {
    this.player?.seekTo(seconds, true);
  }

  setVolume(volume: number): void {
    this.player?.setVolume(Math.round(volume * 100));
  }

  setMuted(muted: boolean): void {
    if (muted) this.player?.mute();
    else this.player?.unMute();
  }

  destroy(): void {
    this.stopPolling();
    this.player?.destroy();
  }
}
