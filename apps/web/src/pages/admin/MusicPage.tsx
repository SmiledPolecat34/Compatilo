import { useCallback, useEffect, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api, apiUpload } from '../../api/client';
import type { MusicSettingsDto, PlaylistSummary } from '../../types';
import type { Playlist, Track } from '../../music/types';
import { Skeleton } from '../../components/Skeleton';
import { useToast } from '../../components/ToastProvider';

export default function MusicPage() {
  const toast = useToast();
  const [playlists, setPlaylists] = useState<PlaylistSummary[] | null>(null);
  const [settings, setSettings] = useState<MusicSettingsDto | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Playlist | null>(null);
  const [newName, setNewName] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const loadList = useCallback(async () => {
    try {
      const [pls, s] = await Promise.all([
        api<PlaylistSummary[]>('/api/admin/music/playlists', { auth: 'admin' }),
        api<MusicSettingsDto>('/api/admin/music/settings', { auth: 'admin' }),
      ]);
      setPlaylists(pls);
      setSettings(s);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chargement impossible.');
    }
  }, [toast]);

  const loadDetail = useCallback(async (id: string) => {
    setDetail(await api<Playlist>(`/api/admin/music/playlists/${id}`, { auth: 'admin' }));
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  async function createPlaylist() {
    if (!newName.trim()) return;
    setError('');
    try {
      const playlist = await api<{ id: string }>('/api/admin/music/playlists', {
        method: 'POST',
        body: { name: newName.trim() },
        auth: 'admin',
      });
      setNewName('');
      await loadList();
      setSelectedId(playlist.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  async function setAsDefault(id: string) {
    try {
      await api(`/api/admin/music/playlists/${id}`, {
        method: 'PATCH',
        body: { isDefault: true },
        auth: 'admin',
      });
      toast.success('Playlist définie par défaut.');
      await loadList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  }

  async function deletePlaylist(id: string) {
    if (!window.confirm('Supprimer cette playlist ? Les pistes non utilisées ailleurs seront supprimées.')) return;
    try {
      await api(`/api/admin/music/playlists/${id}`, { method: 'DELETE', auth: 'admin' });
      if (selectedId === id) setSelectedId(null);
      toast.success('Playlist supprimée.');
      await loadList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  }

  async function toggleEnabled() {
    if (!settings) return;
    try {
      const updated = await api<MusicSettingsDto>('/api/admin/music/settings', {
        method: 'PATCH',
        body: { enabled: !settings.enabled },
        auth: 'admin',
      });
      setSettings(updated);
      toast.success(updated.enabled ? 'Musique activée.' : 'Musique désactivée.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  }

  async function uploadFile(file: File) {
    if (!selectedId) return;
    setBusy(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiUpload(`/api/admin/music/playlists/${selectedId}/tracks/upload`, formData);
      toast.success('Piste ajoutée.');
      await Promise.all([loadDetail(selectedId), loadList()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  async function addYoutube() {
    if (!selectedId || !youtubeUrl.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/music/playlists/${selectedId}/tracks/youtube`, {
        method: 'POST',
        body: { url: youtubeUrl.trim() },
        auth: 'admin',
      });
      setYoutubeUrl('');
      toast.success('Vidéo YouTube ajoutée.');
      await Promise.all([loadDetail(selectedId), loadList()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  async function removeTrack(trackId: string) {
    if (!selectedId) return;
    try {
      await api(`/api/admin/music/playlists/${selectedId}/tracks/${trackId}`, {
        method: 'DELETE',
        auth: 'admin',
      });
      await Promise.all([loadDetail(selectedId), loadList()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    if (!detail || !selectedId) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = detail.tracks.findIndex((t) => t.id === active.id);
    const to = detail.tracks.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(detail.tracks, from, to);
    setDetail({ ...detail, tracks: reordered });
    try {
      await api(`/api/admin/music/playlists/${selectedId}/tracks/order`, {
        method: 'PUT',
        body: { trackIds: reordered.map((t) => t.id) },
        auth: 'admin',
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Réordonnancement impossible.');
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-5 grid gap-3 sm:mb-6 sm:flex sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-brand-900 sm:text-3xl">Musique</h1>
        {settings && (
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600">
            <input
              type="checkbox"
              className="h-5 w-5 accent-brand-600"
              checked={settings.enabled}
              onChange={toggleEnabled}
            />
            Musique activée dans l'application
          </label>
        )}
      </div>

      {playlists === null ? (
        <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="card h-fit min-w-0 p-4">
          <h2 className="mb-3 px-2 text-sm font-bold uppercase tracking-wide text-slate-500">Playlists</h2>
          <ul className="space-y-1">
            {playlists.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                    p.id === selectedId ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-brand-50'
                  }`}
                >
                  <span className="truncate">
                    {p.isDefault && '★ '}
                    {p.name}
                  </span>
                  <span className="ml-2 shrink-0 text-xs opacity-70">{p.trackCount}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,1fr)_auto]">
            <input
              className="input"
              placeholder="Nouvelle playlist"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createPlaylist()}
            />
            <button
              type="button"
              className="btn-secondary shrink-0"
              onClick={createPlaylist}
              aria-label="Créer la playlist"
            >
              +
            </button>
          </div>
        </aside>

        <main className="min-w-0">
          {error && <p className="mb-4 text-sm font-medium text-rose-600">{error}</p>}
          {!detail ? (
            <div className="card p-6 text-center text-slate-500 sm:p-10">
              Sélectionne ou crée une playlist pour ajouter des pistes.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="card grid gap-3 p-4 sm:p-6 md:flex md:items-center md:justify-between">
                <h2 className="min-w-0 font-display text-xl font-bold text-brand-900">{detail.name}</h2>
                <div className="grid gap-2 sm:flex">
                  <button type="button" className="btn-secondary" onClick={() => setAsDefault(detail.id)}>
                    Définir par défaut
                  </button>
                  <button type="button" className="btn-ghost text-rose-500" onClick={() => deletePlaylist(detail.id)}>
                    Supprimer
                  </button>
                </div>
              </div>

              <div className="card space-y-4 p-4 sm:p-6">
                <h3 className="font-semibold text-slate-700">Ajouter une piste</h3>
                <div>
                  <label className="label" htmlFor="upload">
                    Fichier (MP3, WAV, OGG, M4A)
                  </label>
                  <input
                    id="upload"
                    type="file"
                    accept=".mp3,.wav,.ogg,.m4a,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a"
                    className="input"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadFile(file);
                      e.target.value = '';
                    }}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    className="input flex-1"
                    placeholder="Lien YouTube (https://youtube.com/watch?v=...)"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                  />
                  <button type="button" className="btn-secondary shrink-0" onClick={addYoutube} disabled={busy}>
                    Ajouter
                  </button>
                </div>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={detail.tracks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {detail.tracks.map((t) => (
                      <SortableTrack key={t.id} track={t} onRemove={() => removeTrack(t.id)} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              {detail.tracks.length === 0 && (
                <p className="text-center text-slate-500">Cette playlist est vide.</p>
              )}
            </div>
          )}
        </main>
      </div>
      )}
    </div>
  );
}

function SortableTrack({ track, onRemove }: { track: Track; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`card flex min-w-0 items-center gap-3 p-3 ${isDragging ? 'z-10 shadow-2xl' : ''}`}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-lg text-slate-300 active:cursor-grabbing"
        aria-label="Déplacer la piste"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      {track.thumbnailUrl && (
        <img src={track.thumbnailUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-700">{track.title}</p>
        <p className="text-xs text-slate-500">{track.type === 'YOUTUBE' ? 'YouTube' : 'Fichier local'}</p>
      </div>
      <button type="button" className="btn-ghost shrink-0 text-rose-500" onClick={onRemove}>
        Retirer
      </button>
    </div>
  );
}
