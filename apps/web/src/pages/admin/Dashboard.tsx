import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { IdentityDisplayMode, PlaylistSummary, QuestionnaireListItem, SessionSummary } from '../../types';
import SessionStatusBadge from '../../components/SessionStatusBadge';
import { SkeletonCards } from '../../components/Skeleton';
import { useToast } from '../../components/ToastProvider';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

const IDENTITY_LABELS: Record<IdentityDisplayMode, string> = {
  FIRST_NAME: 'Prénom',
  NICKNAME: 'Surnom',
  BOTH: 'Prénom + surnom',
  NONE: 'Aucun (anonyme)',
};

interface CreatedSession {
  id: string;
  pin: string;
  inviteUrl: string;
  inviteMessage: string;
}

export default function Dashboard() {
  const toast = useToast();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [query, setQuery] = useState('');
  const [created, setCreated] = useState<CreatedSession | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(
    (q = '') => {
      api<SessionSummary[]>(`/api/admin/sessions${q ? `?q=${encodeURIComponent(q)}` : ''}`, {
        auth: 'admin',
      })
        .then(setSessions)
        .catch((err) => toast.error(err instanceof Error ? err.message : 'Chargement impossible.'));
    },
    [toast],
  );

  useEffect(() => {
    const timer = setTimeout(() => load(query), 250);
    return () => clearTimeout(timer);
  }, [query, load]);

  return (
    <div className="animate-fade-up">
      <div className="mb-5 grid gap-3 sm:mb-6 sm:flex sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold text-brand-900 sm:text-3xl">Sessions</h1>
        <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => setShowCreate(true)}>
          + Nouvelle session
        </button>
      </div>

      <input
        className="input mb-6 max-w-none sm:max-w-md"
        placeholder="Rechercher : prénom, surnom, PIN, code rapport…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Rechercher une session"
      />

      {sessions === null ? (
        <SkeletonCards />
      ) : sessions.length === 0 ? (
        <div className="card p-6 text-center text-slate-500 sm:p-10">
          Aucune session. Crée ta première session pour inviter un duo !
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => (
            <Link
              key={s.id}
              to={`/admin/sessions/${s.id}`}
              className="card block p-4 transition hover:-translate-y-0.5 hover:shadow-xl sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 font-semibold text-brand-900">
                  {s.label ||
                    (s.participants.length > 0
                      ? s.participants.map((p) => p.firstName).join(' & ')
                      : 'Session sans nom')}
                </div>
                <SessionStatusBadge status={s.status} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{s.questionnaire}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                {s.participants.length === 0 && <span>Personne n'a encore rejoint</span>}
                {s.participants.map((p) => (
                  <span
                    key={p.slot}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      p.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-700'
                    }`}
                  >
                    {p.firstName} {p.completed ? '✓' : '…'}
                  </span>
                ))}
              </div>
              {s.report && (
                <div className="mt-3 text-sm font-semibold text-brand-700">
                  {s.report.code} — {s.report.score}%
                </div>
              )}
              <div className="mt-2 text-xs text-slate-500">
                {new Date(s.createdAt).toLocaleDateString('fr-FR')}
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateSessionModal
          onClose={() => setShowCreate(false)}
          onCreated={(c) => {
            setCreated(c);
            setShowCreate(false);
            load();
          }}
        />
      )}
      {created && <InviteModal created={created} onClose={() => setCreated(null)} />}
    </div>
  );
}

function CreateSessionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (c: CreatedSession) => void;
}) {
  const [label, setLabel] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | ''>('');
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireListItem[]>([]);
  const [questionnaireId, setQuestionnaireId] = useState('');
  const [identityDisplay, setIdentityDisplay] = useState<IdentityDisplayMode>('BOTH');
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [playlistId, setPlaylistId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<QuestionnaireListItem[]>('/api/admin/questionnaires', { auth: 'admin' }).then((list) =>
      setQuestionnaires(list.filter((q) => q.versions.some((v) => v.status === 'PUBLISHED'))),
    );
    api<PlaylistSummary[]>('/api/admin/music/playlists', { auth: 'admin' }).then(setPlaylists);
  }, []);

  async function create() {
    setLoading(true);
    setError('');
    try {
      const result = await api<CreatedSession>('/api/admin/sessions', {
        method: 'POST',
        body: {
          label: label.trim() || undefined,
          questionnaireId: questionnaireId || undefined,
          expiresInDays: expiresInDays === '' ? undefined : expiresInDays,
          identityDisplay,
          playlistId: playlistId || undefined,
        },
        auth: 'admin',
      });
      onCreated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Nouvelle session" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="label">
            Libellé (visible uniquement par toi)
          </label>
          <input
            id="label"
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex. : Léa & Hugo"
          />
        </div>
        <div>
          <label className="label" htmlFor="questionnaire">
            Questionnaire
          </label>
          <select
            id="questionnaire"
            className="input"
            value={questionnaireId}
            onChange={(e) => setQuestionnaireId(e.target.value)}
          >
            <option value="">Dernier questionnaire publié</option>
            {questionnaires.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="expires">
            Expiration (jours, optionnel)
          </label>
          <input
            id="expires"
            type="number"
            min={1}
            max={365}
            className="input"
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Jamais"
          />
        </div>
        <div>
          <span className="label">Nom affiché à l'invité</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(IDENTITY_LABELS) as IdentityDisplayMode[]).map((mode) => (
              <label
                key={mode}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                  identityDisplay === mode ? 'border-brand-400 bg-brand-50 font-semibold text-brand-700' : 'border-brand-100 text-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="identityDisplay"
                  className="accent-brand-600"
                  checked={identityDisplay === mode}
                  onChange={() => setIdentityDisplay(mode)}
                />
                {IDENTITY_LABELS[mode]}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="playlist">
            Playlist (optionnel)
          </label>
          <select
            id="playlist"
            className="input"
            value={playlistId}
            onChange={(e) => setPlaylistId(e.target.value)}
          >
            <option value="">Playlist par défaut</option>
            {playlists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <button type="button" className="btn-primary w-full" onClick={create} disabled={loading}>
          {loading ? 'Création…' : 'Créer la session'}
        </button>
      </div>
    </Modal>
  );
}

function InviteModal({ created, onClose }: { created: CreatedSession; onClose: () => void }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(created.inviteMessage);
    } catch {
      toast.error('Copie impossible — sélectionne et copie le message manuellement.');
      return;
    }
    setCopied(true);
    api(`/api/admin/sessions/${created.id}/invite-copied`, { method: 'POST', auth: 'admin' }).catch(
      () => undefined,
    );
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal title="Session créée 🎉" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg bg-brand-50 p-5 text-center">
          <p className="text-sm font-semibold text-slate-500">Code PIN</p>
          <p className="mt-1 font-display text-4xl font-bold tracking-[0.3em] text-brand-800">
            {created.pin}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Affiché une seule fois — note-le ou copie l'invitation.
          </p>
        </div>
        <div className="rounded-lg border border-brand-100 p-4 text-sm text-slate-600 whitespace-pre-wrap">
          {created.inviteMessage}
        </div>
        <button type="button" className="btn-primary w-full" onClick={copy}>
          {copied ? 'Copié ✓' : "Copier le message d'invitation"}
        </button>
      </div>
    </Modal>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEscapeToClose(true, onClose);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-brand-900/40 backdrop-blur-sm sm:items-center animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="card max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-b-none p-4 sm:rounded-lg sm:p-6 animate-fade-up"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="font-display text-xl font-bold text-brand-900">{title}</h2>
          <button type="button" className="btn-ghost -mr-2 text-slate-500" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
