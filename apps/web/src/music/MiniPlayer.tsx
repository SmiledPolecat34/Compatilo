import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePlayer } from './PlayerContext';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MiniPlayer() {
  const player = usePlayer();
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);

  const showVideo = expanded && player.currentTrack?.type === 'YOUTUBE';
  // Le questionnaire a sa propre barre de navigation fixe en bas d'écran :
  // on remonte le lecteur pour ne jamais chevaucher le bouton "Suivant".
  const clearsFixedFooter = location.pathname === '/session';

  if (!player.enabled) return null;

  return (
    <div
      className={`fixed right-4 z-40 flex flex-col items-end ${clearsFixedFooter ? 'bottom-24' : 'bottom-4'}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/*
        Le panneau reste toujours monté : on ne bascule que sa visibilité
        CSS (`hidden`), jamais son montage React. Le conteneur YouTube
        qu'il contient doit rester le même nœud DOM pendant toute la
        session — le démonter détruirait le lecteur officiel YouTube.
      */}
      <div
        className={`card mb-3 w-72 p-4 sm:w-80 ${expanded ? 'animate-fade-up' : 'hidden'}`}
      >
        <div
          ref={player.youtubeContainerRef}
          className={showVideo ? 'mb-3 aspect-video w-full overflow-hidden rounded-xl' : 'h-0 w-0 overflow-hidden'}
        />

        {player.currentTrack ? (
            <>
              <div className="flex items-center gap-3">
                {player.currentTrack.thumbnailUrl && !showVideo && (
                  <img
                    src={player.currentTrack.thumbnailUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-xl object-cover"
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">{player.currentTrack.title}</p>
                  {player.currentTrack.artist && (
                    <p className="truncate text-xs text-slate-400">{player.currentTrack.artist}</p>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <input
                  type="range"
                  min={0}
                  max={Math.max(player.duration, 1)}
                  value={Math.min(player.currentTime, player.duration || 0)}
                  onChange={(e) => player.seek(Number(e.target.value))}
                  className="w-full accent-brand-600"
                  aria-label="Progression de la piste"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{formatTime(player.currentTime)}</span>
                  <span>{formatTime(player.duration)}</span>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={player.toggleShuffle}
                  aria-pressed={player.shuffle}
                  aria-label="Lecture aléatoire"
                  className={`btn-ghost ${player.shuffle ? 'text-brand-700' : 'text-slate-400'}`}
                >
                  🔀
                </button>
                <button type="button" onClick={player.prev} aria-label="Piste précédente" className="btn-ghost text-slate-600">
                  ⏮
                </button>
                <button
                  type="button"
                  onClick={player.toggle}
                  aria-label={player.isPlaying ? 'Pause' : 'Lecture'}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-brand-600 to-rose-accent text-lg text-white shadow"
                >
                  {player.isPlaying ? '⏸' : '▶'}
                </button>
                <button type="button" onClick={player.next} aria-label="Piste suivante" className="btn-ghost text-slate-600">
                  ⏭
                </button>
                <button
                  type="button"
                  onClick={player.cycleRepeat}
                  aria-label="Répétition"
                  className={`btn-ghost ${player.repeatMode !== 'off' ? 'text-brand-700' : 'text-slate-400'}`}
                >
                  {player.repeatMode === 'one' ? '🔂' : '🔁'}
                </button>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={player.toggleMute}
                  aria-label={player.muted ? 'Réactiver le son' : 'Couper le son'}
                  className="text-slate-500"
                >
                  {player.muted || player.volume === 0 ? '🔇' : '🔊'}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={player.muted ? 0 : player.volume}
                  onChange={(e) => player.setVolume(Number(e.target.value))}
                  className="w-full accent-brand-600"
                  aria-label="Volume"
                />
              </div>

              {player.playlist && player.playlist.tracks.length > 1 && (
                <ul className="mt-3 max-h-32 space-y-0.5 overflow-y-auto border-t border-brand-100 pt-2">
                  {player.playlist.tracks.map((t, i) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => player.selectTrack(i)}
                        className={`w-full truncate rounded-lg px-2 py-1 text-left text-xs ${
                          i === player.currentIndex
                            ? 'bg-brand-100 font-semibold text-brand-700'
                            : 'text-slate-500 hover:bg-brand-50'
                        }`}
                      >
                        {t.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="py-2 text-center text-sm text-slate-400">Aucune playlist disponible.</p>
          )}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl shadow-lg shadow-brand-500/20 ring-1 ring-brand-100 transition active:scale-95"
        aria-label={expanded ? 'Masquer le lecteur' : 'Afficher le lecteur'}
      >
        {player.isPlaying ? '🎵' : '🎧'}
      </button>
    </div>
  );
}
