import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { api, tokens } from '../api/client';
import type { MusicStateResponse, Playlist, RepeatMode, Track } from './types';
import { LocalAudioProvider } from './providers/LocalAudioProvider';
import { YouTubeProvider } from './providers/YouTubeProvider';

interface PlayerContextValue {
  enabled: boolean;
  playlist: Playlist | null;
  currentTrack: Track | null;
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  repeatMode: RepeatMode;
  shuffle: boolean;
  youtubeContainerRef: (el: HTMLDivElement | null) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  selectTrack: (index: number) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

function shuffledOrder(length: number, keepFirst: number): number[] {
  const indices = Array.from({ length }, (_, i) => i).filter((i) => i !== keepFirst);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return keepFirst >= 0 ? [keepFirst, ...indices] : indices;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [enabled, setEnabled] = useState(true);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [queuePos, setQueuePos] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [shuffle, setShuffle] = useState(false);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const localProviderRef = useRef<LocalAudioProvider | null>(null);
  const youtubeProviderRef = useRef<YouTubeProvider | null>(null);
  const youtubeContainerElRef = useRef<HTMLDivElement | null>(null);
  const activeTrackTypeRef = useRef<'LOCAL' | 'YOUTUBE' | null>(null);
  const playlistIdRef = useRef<string | null>(null);

  const currentIndex = order[queuePos] ?? -1;
  const currentTrack = playlist && currentIndex >= 0 ? playlist.tracks[currentIndex] : null;

  const next = useCallback(
    (auto = false) => {
      setQueuePos((pos) => {
        const len = order.length;
        if (len === 0) return pos;
        if (pos + 1 < len) return pos + 1;
        if (!auto || repeatMode === 'all') return 0;
        return pos; // fin de la file, pas de bouclage automatique
      });
    },
    [order.length, repeatMode],
  );

  const prev = useCallback(() => {
    setQueuePos((pos) => {
      const len = order.length;
      if (len === 0) return pos;
      return (pos - 1 + len) % len;
    });
  }, [order.length]);

  // ── Providers persistants (créés une seule fois) ────────────────────
  useEffect(() => {
    if (!audioElRef.current) return;
    localProviderRef.current = new LocalAudioProvider(audioElRef.current, {
      onTimeUpdate: (t) => activeTrackTypeRef.current === 'LOCAL' && setCurrentTime(t),
      onDurationChange: (d) => activeTrackTypeRef.current === 'LOCAL' && setDuration(d),
      onEnded: () => activeTrackTypeRef.current === 'LOCAL' && handleEnded(),
    });
    return () => localProviderRef.current?.destroy();
  }, []);

  useEffect(() => {
    // Le conteneur (rendu par <MiniPlayer/>, enfant de ce provider) est déjà
    // attaché : les refs sont posées avant que les effets ne s'exécutent.
    if (!youtubeContainerElRef.current) return;
    youtubeProviderRef.current = new YouTubeProvider(youtubeContainerElRef.current, {
      onTimeUpdate: (t) => activeTrackTypeRef.current === 'YOUTUBE' && setCurrentTime(t),
      onDurationChange: (d) => activeTrackTypeRef.current === 'YOUTUBE' && setDuration(d),
      onEnded: () => activeTrackTypeRef.current === 'YOUTUBE' && handleEnded(),
    });
    return () => youtubeProviderRef.current?.destroy();
  }, []);

  function handleEnded() {
    if (repeatMode === 'one') {
      const provider = activeProvider();
      provider?.seek(0);
      void provider?.play();
      return;
    }
    next(true);
  }

  function activeProvider() {
    return activeTrackTypeRef.current === 'YOUTUBE'
      ? youtubeProviderRef.current
      : localProviderRef.current;
  }

  // ── Charger la piste courante dans le bon provider ───────────────────
  useEffect(() => {
    if (!currentTrack) return;
    const previousType = activeTrackTypeRef.current;
    if (previousType && previousType !== currentTrack.type) {
      (previousType === 'YOUTUBE' ? youtubeProviderRef.current : localProviderRef.current)?.pause();
    }
    activeTrackTypeRef.current = currentTrack.type;
    setCurrentTime(0);
    setDuration(currentTrack.durationSeconds ?? 0);
    const provider = activeProvider();
    provider?.load(currentTrack);
    if (isPlaying) void provider?.play();
    // Ne dépend volontairement que de l'identité de la piste : isPlaying
    // est géré par l'effet dédié ci-dessous pour éviter un double play().
  }, [currentTrack?.id]);

  // ── Réagir à isPlaying ─────────────────────────────────────────────
  useEffect(() => {
    const provider = activeProvider();
    if (!provider || !currentTrack) return;
    if (isPlaying) void provider.play();
    else provider.pause();
  }, [isPlaying]);

  // ── Volume / mute ────────────────────────────────────────────────────
  useEffect(() => {
    localProviderRef.current?.setVolume(volume);
    youtubeProviderRef.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    localProviderRef.current?.setMuted(muted);
    youtubeProviderRef.current?.setMuted(muted);
  }, [muted]);

  // ── Récupération de la playlist active (page d'accueil vs session) ──
  // Ne réinitialise la file que si la playlist a réellement changé : le
  // changement de page ne doit jamais interrompre une lecture en cours.
  const refreshPlaylist = useCallback(async () => {
    try {
      const hasParticipant = Boolean(tokens.get('participant'));
      const inSessionArea = location.pathname.startsWith('/session');
      const result = await api<MusicStateResponse>(
        hasParticipant && inSessionArea ? '/api/public/music/now' : '/api/public/music/default',
        hasParticipant && inSessionArea ? { auth: 'participant' } : undefined,
      );
      setEnabled(result.enabled);

      if (result.playlist?.id === playlistIdRef.current) {
        setPlaylist(result.playlist); // rafraîchit les métadonnées sans couper la lecture
        return;
      }
      playlistIdRef.current = result.playlist?.id ?? null;
      setPlaylist(result.playlist);
      const length = result.playlist?.tracks.length ?? 0;
      setOrder(shuffle ? shuffledOrder(length, -1) : Array.from({ length }, (_, i) => i));
      setQueuePos(0);
      setIsPlaying(false);
    } catch {
      // silencieux : la musique est un agrément, pas une fonction critique
    }
  }, [location.pathname, shuffle]);

  useEffect(() => {
    void refreshPlaylist();
  }, [refreshPlaylist]);

  const toggleShuffle = useCallback(() => {
    setShuffle((prevShuffle) => {
      const next = !prevShuffle;
      if (playlist) {
        const newOrder = next
          ? shuffledOrder(playlist.tracks.length, currentIndex)
          : Array.from({ length: playlist.tracks.length }, (_, i) => i);
        setOrder(newOrder);
        setQueuePos(0);
      }
      return next;
    });
  }, [playlist, currentIndex]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      enabled,
      playlist,
      currentTrack,
      currentIndex,
      isPlaying,
      currentTime,
      duration,
      volume,
      muted,
      repeatMode,
      shuffle,
      youtubeContainerRef: (el) => {
        youtubeContainerElRef.current = el;
      },
      toggle: () => setIsPlaying((p) => (currentTrack ? !p : p)),
      next: () => next(false),
      prev,
      seek: (seconds: number) => {
        activeProvider()?.seek(seconds);
        setCurrentTime(seconds);
      },
      setVolume: (v: number) => setVolumeState(Math.min(1, Math.max(0, v))),
      toggleMute: () => setMuted((m) => !m),
      cycleRepeat: () =>
        setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off')),
      toggleShuffle,
      selectTrack: (index: number) => {
        const pos = order.indexOf(index);
        if (pos >= 0) {
          setQueuePos(pos);
          setIsPlaying(true);
        }
      },
    }),
    [
      enabled,
      playlist,
      currentTrack,
      currentIndex,
      isPlaying,
      currentTime,
      duration,
      volume,
      muted,
      repeatMode,
      shuffle,
      order,
      next,
      prev,
      toggleShuffle,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>
      {/* Élément de lecture audio persistant : jamais démonté au changement de route */}
      <audio ref={audioElRef} className="hidden" />
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer doit être utilisé dans <PlayerProvider>.');
  return ctx;
}
