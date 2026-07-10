/** Types minimaux pour l'API IFrame YouTube officielle (pas de paquet npm requis). */
declare namespace YT {
  enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }

  interface PlayerEvent {
    target: Player;
    data?: number;
  }

  interface PlayerOptions {
    width?: string | number;
    height?: string | number;
    videoId?: string;
    playerVars?: Record<string, number | string>;
    events?: {
      onReady?: (event: PlayerEvent) => void;
      onStateChange?: (event: PlayerEvent) => void;
      onError?: (event: PlayerEvent) => void;
    };
  }

  class Player {
    constructor(element: string | HTMLElement, options: PlayerOptions);
    playVideo(): void;
    pauseVideo(): void;
    stopVideo(): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    loadVideoById(videoId: string): void;
    cueVideoById(videoId: string): void;
    setVolume(volume: number): void;
    mute(): void;
    unMute(): void;
    getCurrentTime(): number;
    getDuration(): number;
    destroy(): void;
  }
}

interface Window {
  YT?: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
}
