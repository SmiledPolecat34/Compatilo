import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, tokens } from '../../api/client';
import type {
  AnswerValue,
  IdentityDisplayMode,
  ParticipantAnswers,
  PlaylistSummary,
  SessionDetail,
  TimelineEvent,
} from '../../types';
import ReportView from '../../components/report/ReportView';
import SessionStatusBadge from '../../components/SessionStatusBadge';
import { Skeleton } from '../../components/Skeleton';
import { useToast } from '../../components/ToastProvider';
import { Modal } from './Dashboard';

const IDENTITY_LABELS: Record<IdentityDisplayMode, string> = {
  FIRST_NAME: 'Prénom',
  NICKNAME: 'Surnom',
  BOTH: 'Prénom + surnom',
  NONE: 'Aucun (anonyme)',
};

const TRILEAN_LABELS: Record<string, string> = { YES: 'Oui', POSSIBLE: 'Possible', NO: 'Non' };

function formatAnswerValue(value: AnswerValue | null): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return TRILEAN_LABELS[value] ?? value;
  if (typeof value === 'object' && 'city' in value) {
    return value.city || '—';
  }
  if (typeof value === 'object' && 'selected' in value) {
    const parts = [...value.selected];
    if (value.custom) parts.push(value.custom);
    return parts.length > 0 ? parts.join(', ') : '—';
  }
  return String(value);
}

interface GroupedEvent {
  key: string;
  type: string;
  message: string;
  events: TimelineEvent[];
}

function groupTimeline(events: TimelineEvent[]): GroupedEvent[] {
  const groups: GroupedEvent[] = [];
  for (const e of events) {
    const last = groups[groups.length - 1];
    if (last && last.type === e.type && last.message === e.message) {
      last.events.push(e);
    } else {
      groups.push({ key: e.id, type: e.type, message: e.message, events: [e] });
    }
  }
  return groups;
}

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
  const toast = useToast();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinName, setJoinName] = useState('');
  const [joinNickname, setJoinNickname] = useState('');
  const [joining, setJoining] = useState(false);
  const [expandedParticipantId, setExpandedParticipantId] = useState<string | null>(null);
  const [recapByParticipant, setRecapByParticipant] = useState<Record<string, ParticipantAnswers>>({});
  const [recapLoading, setRecapLoading] = useState(false);
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const notesTimer = useRef<ReturnType<typeof setTimeout>>();
  const groupedTimeline = useMemo(() => groupTimeline(timeline), [timeline]);

  const load = useCallback(() => {
    if (!id) return;
    api<SessionDetail>(`/api/admin/sessions/${id}`, { auth: 'admin' })
      .then((s) => {
        setSession(s);
        setNotes(s.privateNotes ?? '');
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Chargement impossible.'));
    api<TimelineEvent[]>(`/api/admin/sessions/${id}/timeline`, { auth: 'admin' }).then(setTimeline);
  }, [id, toast]);

  useEffect(load, [load]);
  useEffect(() => {
    api<PlaylistSummary[]>('/api/admin/music/playlists', { auth: 'admin' }).then(setPlaylists);
  }, []);

  function saveNotes(value: string) {
    setNotes(value);
    setNotesSaved(false);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      try {
        await api(`/api/admin/sessions/${id}`, {
          method: 'PATCH',
          body: { privateNotes: value || null },
          auth: 'admin',
        });
        setNotesSaved(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Enregistrement des notes impossible.');
      }
    }, 600);
  }

  async function toggleAccess() {
    if (!session) return;
    try {
      await api(`/api/admin/sessions/${id}`, {
        method: 'PATCH',
        body: { reportAccessEnabled: !session.reportAccessEnabled },
        auth: 'admin',
      });
      toast.success(session.reportAccessEnabled ? 'Accès au rapport désactivé.' : 'Accès au rapport activé.');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  }

  async function updateIdentityDisplay(mode: IdentityDisplayMode) {
    try {
      await api(`/api/admin/sessions/${id}`, {
        method: 'PATCH',
        body: { identityDisplay: mode },
        auth: 'admin',
      });
      toast.success('Visibilité de l’identité mise à jour.');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  }

  async function updatePlaylist(newPlaylistId: string) {
    try {
      await api(`/api/admin/sessions/${id}`, {
        method: 'PATCH',
        body: { playlistId: newPlaylistId || null },
        auth: 'admin',
      });
      toast.success('Playlist mise à jour.');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  }

  async function remove() {
    if (!window.confirm('Supprimer définitivement cette session et toutes ses données ?')) return;
    try {
      await api(`/api/admin/sessions/${id}`, { method: 'DELETE', auth: 'admin' });
      navigate('/admin');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  }

  async function closeSession() {
    if (
      !window.confirm(
        'Fermer cette session ? Plus personne ne pourra répondre, se signer, ni rejoindre. Le rapport sera figé.',
      )
    )
      return;
    try {
      await api(`/api/admin/sessions/${id}/close`, { method: 'POST', auth: 'admin' });
      toast.success('Session fermée.');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  }

  async function reopenSession() {
    if (!window.confirm('Rouvrir cette session ?')) return;
    try {
      await api(`/api/admin/sessions/${id}/reopen`, { method: 'POST', auth: 'admin' });
      toast.success('Session rouverte.');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  }

  const adminParticipant = session?.participants.find((p) => p.isAdmin) ?? null;

  async function openQuestionnaireAsAdmin(firstName: string, nickname: string) {
    setJoining(true);
    try {
      const result = await api<{ token: string; participant: { completed: boolean } }>(
        `/api/admin/sessions/${id}/join`,
        {
          method: 'POST',
          body: { firstName: firstName.trim(), nickname: nickname.trim() || undefined },
          auth: 'admin',
        },
      );
      tokens.set('participant', result.token);
      setShowJoinModal(false);
      navigate(result.participant.completed ? '/session/report' : '/session');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setJoining(false);
    }
  }

  async function toggleParticipantRecap(participantId: string) {
    if (expandedParticipantId === participantId) {
      setExpandedParticipantId(null);
      return;
    }
    setExpandedParticipantId(participantId);
    if (recapByParticipant[participantId]) return;
    setRecapLoading(true);
    try {
      const recap = await api<ParticipantAnswers>(
        `/api/admin/sessions/${id}/participants/${participantId}/answers`,
        { auth: 'admin' },
      );
      setRecapByParticipant((prev) => ({ ...prev, [participantId]: recap }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chargement des réponses impossible.');
      setExpandedParticipantId(null);
    } finally {
      setRecapLoading(false);
    }
  }

  function startAnswering() {
    if (adminParticipant) {
      openQuestionnaireAsAdmin(adminParticipant.firstName, '');
    } else {
      setJoinName('');
      setJoinNickname('');
      setShowJoinModal(true);
    }
  }

  if (!session) {
    return (
      <div className="animate-fade-up space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <Link to="/admin" className="btn-ghost mb-4 inline-flex">
        ← Sessions
      </Link>
      <div className="mb-6 grid gap-4 lg:flex lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 font-display text-2xl font-bold text-brand-900 sm:text-3xl">
              {session.label ||
                session.participants.map((p) => p.firstName).join(' & ') ||
                'Session sans nom'}
            </h1>
            <SessionStatusBadge status={session.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {session.questionnaire} · créée le{' '}
            {new Date(session.createdAt).toLocaleString('fr-FR')}
            {session.expiresAt &&
              ` · expire le ${new Date(session.expiresAt).toLocaleDateString('fr-FR')}`}
            {session.closedAt && ` · fermée le ${new Date(session.closedAt).toLocaleString('fr-FR')}`}
          </p>
        </div>
        <div className="grid gap-2 sm:flex lg:justify-end">
          {session.status !== 'CLOSED' &&
            (!adminParticipant || !adminParticipant.completedAt) && (
              <button type="button" className="btn-primary" onClick={startAnswering} disabled={joining}>
                {adminParticipant ? 'Continuer à répondre' : 'Répondre au questionnaire'}
              </button>
            )}
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
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <span aria-hidden className="text-lg">
            🔒
          </span>
          Session fermée : réponses, favoris, signatures et nouveaux participants sont bloqués. Le
          rapport reste consultable si l'accès invité est activé, mais plus rien ne peut changer.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-6 lg:col-span-2">
          {/* Participants */}
          <section className="card p-4 sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-brand-900">Participants</h2>
            {session.participants.length === 0 ? (
              <p className="text-slate-500">Personne n'a encore rejoint la session.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {session.participants.map((p) => {
                  const isExpanded = expandedParticipantId === p.id;
                  const recap = recapByParticipant[p.id];
                  return (
                    <div key={p.id} className="rounded-lg border border-brand-100 p-4 sm:col-span-1">
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => p.answeredCount > 0 && toggleParticipantRecap(p.id)}
                        aria-expanded={isExpanded}
                        disabled={p.answeredCount === 0}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-brand-900">
                            {p.firstName}{' '}
                            {p.nickname && <span className="text-slate-500">« {p.nickname} »</span>}
                            {p.isAdmin && (
                              <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                                Moi (admin)
                              </span>
                            )}
                          </div>
                          {p.answeredCount > 0 && (
                            <span aria-hidden className="text-slate-400">
                              {isExpanded ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-slate-500">
                          <p>
                            Progression : {p.answeredCount}/{session.totalQuestions} réponses
                          </p>
                          <p>Favoris : {p.favoritesCount}</p>
                          <p>
                            {p.completedAt
                              ? `Terminé le ${new Date(p.completedAt).toLocaleString('fr-FR')}`
                              : 'En cours'}
                          </p>
                          {p.locationConsent && (
                            <p>
                              📍 {p.city ?? 'Ville inconnue'}
                              {p.latitude != null && p.longitude != null && (
                                <span className="text-xs text-slate-500">
                                  {' '}
                                  ({p.latitude.toFixed(4)}, {p.longitude.toFixed(4)})
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="mt-4 space-y-4 border-t border-brand-100 pt-4">
                          {recapLoading && !recap ? (
                            <p className="text-sm text-slate-500">Chargement…</p>
                          ) : (
                            recap?.pages.map((page) => (
                              <div key={page.title}>
                                <h3 className="text-sm font-semibold text-brand-800">{page.title}</h3>
                                <ul className="mt-2 space-y-2">
                                  {page.questions.map((q) => (
                                    <li key={q.id} className="text-sm">
                                      <p className="text-slate-500">
                                        {q.prompt}
                                        {q.isFavorite && (
                                          <span className="ml-1 text-amber-400" aria-hidden>
                                            ★
                                          </span>
                                        )}
                                      </p>
                                      <p className="font-medium text-slate-800">
                                        {formatAnswerValue(q.value)}
                                      </p>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Rapport */}
          <section className="card p-4 sm:p-6">
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
          <section className="card p-4 sm:p-6">
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
          <section className="card p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-brand-900">Notes privées</h2>
              <span className="text-xs text-slate-500">{notesSaved ? 'Enregistré ✓' : '…'}</span>
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
          <section className="card p-4 sm:p-6">
            <h2 className="mb-4 font-display text-lg font-bold text-brand-900">Timeline</h2>
            <ol className="space-y-3">
              {groupedTimeline.map((g) => {
                const latest = g.events[0];
                const isMulti = g.events.length > 1;
                const isExpanded = expandedGroupKey === g.key;
                return (
                  <li key={g.key} className="text-sm">
                    <button
                      type="button"
                      className={`flex w-full items-start gap-3 text-left ${isMulti ? 'cursor-pointer' : 'cursor-default'}`}
                      onClick={() => isMulti && setExpandedGroupKey(isExpanded ? null : g.key)}
                      disabled={!isMulti}
                    >
                      <span aria-hidden>{EVENT_ICONS[g.type] ?? '•'}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-slate-700">
                          {g.message}
                          {isMulti && (
                            <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                              x{g.events.length}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(latest.createdAt).toLocaleString('fr-FR')}
                          {isMulti && <span className="ml-1">{isExpanded ? '▲' : '▼'}</span>}
                        </p>
                      </div>
                    </button>
                    {isMulti && isExpanded && (
                      <ul className="ml-7 mt-2 space-y-1 border-l border-brand-100 pl-3">
                        {g.events.map((e) => (
                          <li key={e.id} className="text-xs text-slate-500">
                            {new Date(e.createdAt).toLocaleString('fr-FR')}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
              {timeline.length === 0 && <p className="text-slate-500">Aucun événement.</p>}
            </ol>
          </section>
        </div>
      </div>

      {showJoinModal && (
        <Modal title="Répondre au questionnaire" onClose={() => setShowJoinModal(false)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Réponds en tant que second participant, en parallèle de ton invité·e. Le
              questionnaire s'ouvre dans un nouvel onglet.
            </p>
            <div>
              <label className="label" htmlFor="joinName">
                Ton prénom *
              </label>
              <input
                id="joinName"
                className="input"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                maxLength={60}
                autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="joinNickname">
                Surnom (optionnel)
              </label>
              <input
                id="joinNickname"
                className="input"
                value={joinNickname}
                onChange={(e) => setJoinNickname(e.target.value)}
                maxLength={60}
              />
            </div>
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => openQuestionnaireAsAdmin(joinName, joinNickname)}
              disabled={joining || joinName.trim().length < 3}
            >
              {joining ? 'Ouverture…' : 'Commencer'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
