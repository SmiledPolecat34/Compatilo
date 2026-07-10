import { apiUrl } from '../../api/client';
import type { PlaybackCallbacks, PlaybackProvider, Track } from '../types';

/** Lit les pistes LOCAL (MP3/WAV/OGG) via un élément <audio> partagé. */
export class LocalAudioProvider implements PlaybackProvider {
  constructor(
    private readonly audio: HTMLAudioElement,
    callbacks: PlaybackCallbacks,
  ) {
    audio.addEventListener('timeupdate', () => callbacks.onTimeUpdate(audio.currentTime));
    audio.addEventListener('durationchange', () => {
      if (Number.isFinite(audio.duration)) callbacks.onDurationChange(audio.duration);
    });
    audio.addEventListener('ended', callbacks.onEnded);
    audio.addEventListener('error', () => callbacks.onError?.('Lecture audio impossible.'));
  }

  load(track: Track): void {
    if (!track.fileUrl) return;
    this.audio.src = apiUrl(track.fileUrl);
    this.audio.currentTime = 0;
  }

  play() {
    return this.audio.play();
  }

  pause(): void {
    this.audio.pause();
  }

  seek(seconds: number): void {
    this.audio.currentTime = seconds;
  }

  setVolume(volume: number): void {
    this.audio.volume = Math.min(1, Math.max(0, volume));
  }

  setMuted(muted: boolean): void {
    this.audio.muted = muted;
  }

  destroy(): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
  }
}
