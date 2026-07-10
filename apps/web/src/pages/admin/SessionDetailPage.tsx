import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { IdentityDisplayMode, PlaylistSummary, SessionDetail, TimelineEvent } from '../../types';
import ReportView from '../../components/report/ReportView';
import SessionStatusBadge from '../../components/SessionStatusBadge';

const IDENTITY_LABELS: Record<IdentityDisplayMode, string> = {
  FIRST_NAME: 'Prénom',
  NICKNAME: 'Surnom',
  BOTH: 'Prénom + surnom',
  NONE: 'Aucun (anonyme)',
};

const EVENT_ICONS: Record<string, string> = {
  'session.created': '✨',
  'pin.generated': '🔢',
  'invite.copied': '📋',
  'participant.joined': '👋',
  'participant.resumed': '↩️',
  'questionnaire.started': '▶️',
  'answer.saved': '💾',
  'questionnaire.completed': '✅',
  'report.generated': '📄',
  'signature.saved': '✍️',
  'access.enabled': '🔓',
  'access.disabled': '🔒',
  'session.closed': '🔴',
  'session.reopened': '🟢',
};

export default function SessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const notesTimer = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(() => {
    if (!id) return;
    api<SessionDetail>(`/api/admin/sessions/${id}`, { auth: 'admin' }).then((s) => {
      setSession(s);
      setNotes(s.privateNotes ?? '');
    });
    api<TimelineEvent[]>(`/api/admin/sessions/${id}/timeline`, { auth: 'admin' }).then(setTimeline);
  }, [id]);

  useEffect(load, [load]);
  useEffect(() => {
    api<PlaylistSummary[]>('/api/admin/music/playlists', { auth: 'admin' }).then(setPlaylists);
  }, []);

  function saveNotes(value: string) {
    setNotes(value);
    setNotesSaved(false);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      await api(`/api/admin/sessions/${id}`, {
        method: 'PATCH',
        body: { privateNotes: value || null },
        auth: 'admin',
      });
      setNotesSaved(true);
    }, 600);
  }

  async function toggleAccess() {
    if (!session) return;
    await api(`/api/admin/sessions/${id}`, {
      method: 'PATCH',
      body: { reportAccessEnabled: !session.reportAccessEnabled },
      auth: 'admin',
    });
    load();
  }

  async function updateIdentityDisplay(mode: IdentityDisplayMode) {
    await api(`/api/admin/sessions/${id}`, {
      method: 'PATCH',
      body: { identityDisplay: mode },
      auth: 'admin',
    });
    load();
  }

  async function updatePlaylist(newPlaylistId: string) {
    await api(`/api/admin/sessions/${id}`, {
      method: 'PATCH',
      body: { playlistId: newPlaylistId || null },
      auth: 'admin',
    });
    load();
  }

  async function remove() {
    if (!window.confirm('Supprimer définitivement cette session et toutes ses données ?')) return;
    await api(`/api/admin/sessions/${id}`, { method: 'DELETE', auth: 'admin' });
    navigate('/admin');
  }

  async function closeSession() {
    if (
      !window.confirm(
        'Fermer cette session ? Plus personne ne pourra répondre, se signer, ni rejoindre. Le rapport sera figé.',
      )
    )
      return;
    await api(`/api/admin/sessions/${id}/close`, { method: 'POST', auth: 'admin' });
    load();
  }

  async function reopenSession() {
    if (!window.confirm('Rouvrir cette session ?')) return;
    await api(`/api/admin/sessions/${id}/reopen`, { method: 'POST', auth: 'admin' });
    load();
  }

  if (!session) {
    return <div className="p-10 text-center text-slate-500">Chargement…</div>;
  }

  return (
    <div className="animate-fade-up">
      <Link to="/admin" className="btn-ghost mb-4 inline-flex">
        ← Sessions
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold text-brand-900">
              {session.label ||
                session.participants.map((p) => p.firstName).join(' & ') ||
                'Session sans nom'}
            </h1>
            <SessionStatusBadge status={session.status} />
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {session.questionnaire} · créée le{' '}
            {new Date(session.createdAt).toLocaleString('fr-FR')}
            {session.expiresAt &&
              ` · expire le ${new Date(session.expiresAt).toLocaleDateString('fr-FR')}`}
            {session.closedAt && ` · fermée le ${new Date(session.closedAt).toLocaleString('fr-FR')}`}
          </p>
        </div>
        <div className="flex gap-2">
          {session.status === 'CLOSED' ? (
            <button type="button" className="btn-secondary" onClick={reopenSession}>
              Rouvrir la session
            </button>
          ) : (
            <button type="button" className="btn-secondary" onClick={closeSession}>
              Fermer la session
            </button>
          )}
          <button type="button" className="btn-ghost text-rose-500" onClick={remove}>
            Supprimer
          </button>
        </div>
      </div>

      {session.status === 'CLOSED' && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <span aria-hidden className="text-lg">
            🔒
          </span>
          Session fermée : réponses, favoris, signatures et nouveaux participants sont bloqués. Le
          rapport reste consultable si l'accès invité est activé, mais plus rien ne peut changer.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Participants */}
          <section className="card p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-brand-900">Participants</h2>
            {session.participants.length === 0 ? (
              <p className="text-slate-500">Personne n'a encore rejoint la session.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {session.participants.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-brand-100 p-4">
                    <div className="font-semibold text-brand-900">
                      {p.firstName} {p.nickname && <span className="text-slate-400">« {p.nickname} »</span>}
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-slate-500">
                      <p>
                        Progression : {p.answeredCount}/{session.totalQuestions} réponses
                      </p>
                      <p>Favoris : {p.favoritesCount}</p>
                      <p>{p.completedAt ? `Terminé le ${new Date(p.completedAt).toLocaleString('fr-FR')}` : 'En cours'}</p>
                      {p.locationConsent && (
                        <p>
                          📍 {p.city ?? 'Ville inconnue'}
                          {p.latitude != null && p.longitude != null && (
                            <span className="text-xs text-slate-400">
                              {' '}
                              ({p.latitude.toFixed(4)}, {p.longitude.toFixed(4)})
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Rapport */}
          <section className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-brand-900">Rapport</h2>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-brand-600"
                  checked={session.reportAccessEnabled}
                  onChange={toggleAccess}
                />
                Accès invité au rapport
              </label>
            </div>
            {session.report ? (
              <div className="mt-4">
                <p className="text-sm text-slate-500">
                  {session.report.code} — score {session.report.score}% — généré le{' '}
                  {new Date(session.report.generatedAt).toLocaleString('fr-FR')}
                </p>
                <button
                  type="button"
                  className="btn-secondary mt-3"
                  onClick={() => setShowReport((v) => !v)}
                >
                  {showReport ? 'Masquer le rapport' : 'Afficher le rapport'}
                </button>
              </div>
            ) : (
              <p className="mt-4 text-slate-500">
                Le rapport sera généré quand les deux participants auront terminé.
              </p>
            )}
          </section>

          {showReport && session.report && (
            <ReportView
              code={session.report.code}
              score={session.report.score}
              generatedAt={session.report.generatedAt}
              data={session.report.data}
              signatures={session.report.signatures}
            />
          )}
        </div>

        <div className="space-y-6">
          {/* Réglages */}
          <section className="card p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-brand-900">Réglages</h2>
            <div className="space-y-4">
              <div>
                <span className="label">Nom affiché à l'invité</span>
                <select
                  className="input"
                  value={session.identityDisplay}
                  onChange={(e) => updateIdentityDisplay(e.target.value as IdentityDisplayMode)}
                  aria-label="Nom affiché à l'invité"
                >
                  {(Object.keys(IDENTITY_LABELS) as IdentityDisplayMode[]).map((mode) => (
                    <option key={mode} value={mode}>
                      {IDENTITY_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="label">Playlist</span>
                <select
                  className="input"
                  value={session.playlist?.id ?? ''}
                  onChange={(e) => updatePlaylist(e.target.value)}
                  aria-label="Playlist de la session"
                >
                  <option value="">Playlist par défaut</option>
                  {playlists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Notes privées */}
          <section className="card p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-brand-900">Notes privées</h2>
              <span className="text-xs text-slate-400">{notesSaved ? 'Enregistré ✓' : '…'}</span>
            </div>
            <textarea
              className="input min-h-32 resize-y"
              value={notes}
              onChange={(e) => saveNotes(e.target.value)}
              placeholder="Visible uniquement ici."
              aria-label="Notes privées"
            />
          </section>

          {/* Timeline */}
          <section className="card p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-brand-900">Timeline</h2>
            <ol className="space-y-3">
              {timeline.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span aria-hidden>{EVENT_ICONS[e.type] ?? '•'}</span>
                  <div>
                    <p className="text-slate-700">{e.message}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(e.createdAt).toLocaleString('fr-FR')}
                    </p>
                  </div>
                </li>
              ))}
              {timeline.length === 0 && <p className="text-slate-500">Aucun événement.</p>}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
