import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { QuestionnaireListItem } from '../../types';
import { Modal } from './Dashboard';
import { SkeletonCards } from '../../components/Skeleton';
import { useToast } from '../../components/ToastProvider';

export default function QuestionnairesPage() {
  const toast = useToast();
  const [items, setItems] = useState<QuestionnaireListItem[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<QuestionnaireListItem[]>('/api/admin/questionnaires', { auth: 'admin' })
      .then(setItems)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Chargement impossible.'));
  }, [toast]);

  useEffect(load, [load]);

  async function create() {
    try {
      await api('/api/admin/questionnaires', {
        method: 'POST',
        body: { title: title.trim(), description: description.trim() || undefined },
        auth: 'admin',
      });
      setShowCreate(false);
      setTitle('');
      setDescription('');
      toast.success('Questionnaire créé.');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  async function action(path: string, successMessage: string) {
    setError('');
    try {
      await api(path, { method: 'POST', auth: 'admin' });
      toast.success(successMessage);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-brand-900">Questionnaires</h1>
        <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>
          + Nouveau questionnaire
        </button>
      </div>

      {error && <p className="mb-4 text-sm font-medium text-rose-600">{error}</p>}

      {items === null ? (
        <SkeletonCards count={3} />
      ) : (
      <div className="space-y-4">
        {items.map((q) => {
          const draft = q.versions.find((v) => v.status === 'DRAFT');
          const published = q.versions.find((v) => v.status === 'PUBLISHED');
          return (
            <div key={q.id} className="card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-brand-900">{q.title}</h2>
                  {q.description && <p className="mt-1 text-sm text-slate-500">{q.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {published && (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-700">
                        v{published.version} publiée
                      </span>
                    )}
                    {draft && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-semibold text-amber-700">
                        v{draft.version} brouillon
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {draft ? (
                    <Link to={`/admin/questionnaires/versions/${draft.id}`} className="btn-secondary">
                      Éditer le brouillon
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => action(`/api/admin/questionnaires/${q.id}/draft`, 'Brouillon créé.')}
                    >
                      Nouvelle version
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => action(`/api/admin/questionnaires/${q.id}/duplicate`, 'Questionnaire dupliqué.')}
                  >
                    Dupliquer
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {showCreate && (
        <Modal title="Nouveau questionnaire" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="qTitle">
                Titre *
              </label>
              <input
                id="qTitle"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="qDesc">
                Description
              </label>
              <textarea
                id="qDesc"
                className="input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn-primary w-full"
              onClick={create}
              disabled={title.trim().length === 0}
            >
              Créer
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
