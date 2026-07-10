import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, tokens } from '../../api/client';
import type { QuestionnairePayload, TrileanValue } from '../../types';
import Logo from '../../components/Logo';
import { getQuestionComponent } from '../../components/questions/registry';

type Phase = 'loading' | 'intro' | 'quiz' | 'error';

export default function SessionFlow() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('loading');
  const [data, setData] = useState<QuestionnairePayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, TrileanValue>>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [pageIndex, setPageIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!tokens.get('participant')) {
      navigate('/');
      return;
    }
    api<QuestionnairePayload>('/api/public/me/questionnaire', { auth: 'participant' })
      .then((payload) => {
        if (payload.participant.completed) {
          navigate('/session/report');
          return;
        }
        setData(payload);
        setAnswers(payload.answers);
        setFavorites(new Set(payload.favorites));
        // Reprise automatique : on saute l'intro si des réponses existent déjà
        const hasProgress = Object.keys(payload.answers).length > 0;
        setPhase(hasProgress || payload.readOnly ? 'quiz' : 'intro');
        if (hasProgress) {
          const idx = payload.questionnaire.pages.findIndex((p) =>
            p.questions.some((q) => !(q.id in payload.answers)),
          );
          setPageIndex(idx === -1 ? payload.questionnaire.pages.length - 1 : idx);
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          tokens.clear('participant');
          navigate('/');
        } else {
          setError(err instanceof Error ? err.message : 'Erreur');
          setPhase('error');
        }
      });
  }, [navigate]);

  const allQuestions = useMemo(
    () => data?.questionnaire.pages.flatMap((p) => p.questions) ?? [],
    [data],
  );
  const answeredCount = allQuestions.filter((q) => q.id in answers).length;
  const progress = allQuestions.length > 0 ? Math.round((answeredCount / allQuestions.length) * 100) : 0;

  const saveAnswer = useCallback(async (questionId: string, value: TrileanValue) => {
    if (data?.readOnly) return;
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setSaving(true);
    try {
      await api(`/api/public/me/answers/${questionId}`, {
        method: 'PUT',
        body: { value },
        auth: 'participant',
      });
    } catch {
      setError('Sauvegarde impossible — vérifie ta connexion.');
    } finally {
      setSaving(false);
    }
  }, [data?.readOnly]);

  const toggleFavorite = useCallback(
    async (questionId: string) => {
      if (data?.readOnly) return;
      const next = new Set(favorites);
      if (next.has(questionId)) next.delete(questionId);
      else if (next.size < (data?.favoritesRule.max ?? 5)) next.add(questionId);
      else return;
      setFavorites(next);
      try {
        await api('/api/public/me/favorites', {
          method: 'PUT',
          body: { questionIds: [...next] },
          auth: 'participant',
        });
      } catch {
        setError('Sauvegarde des favoris impossible.');
      }
    },
    [favorites, data],
  );

  async function complete() {
    setCompleting(true);
    setError('');
    try {
      await api('/api/public/me/complete', { method: 'POST', auth: 'participant' });
      navigate('/session/report');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setCompleting(false);
    }
  }

  if (phase === 'loading') {
    return <CenteredMessage>Chargement…</CenteredMessage>;
  }
  if (phase === 'error' || !data) {
    return <CenteredMessage>{error || 'Une erreur est survenue.'}</CenteredMessage>;
  }

  if (phase === 'intro') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
        <div className="card w-full max-w-md p-8 text-center animate-fade-up">
          <Logo size={44} />
          <h1 className="mt-6 font-display text-2xl font-bold text-brand-900">
            Bonjour {data.participant.firstName} 👋
          </h1>
          <p className="mt-4 text-slate-600">{data.questionnaire.description}</p>
          <div className="mt-6 rounded-2xl bg-gradient-to-br from-brand-50 to-rose-50 p-5 text-left">
            <div className="text-2xl">⭐</div>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              Pendant le questionnaire, sélectionne entre{' '}
              <strong>{data.favoritesRule.min} et {data.favoritesRule.max} réponses ou questions
              favorites</strong>. Elles apparaîtront ensuite sur ta carte de profil.
            </p>
          </div>
          <button type="button" className="btn-primary mt-8 w-full" onClick={() => setPhase('quiz')}>
            Commencer
          </button>
        </div>
      </div>
    );
  }

  const page = data.questionnaire.pages[pageIndex];
  const isLastPage = pageIndex === data.questionnaire.pages.length - 1;
  const allAnswered = answeredCount === allQuestions.length;
  const favoritesOk = favorites.size >= data.favoritesRule.min;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-2xl px-4 pb-32 pt-6">
      {/* Barre de progression */}
      <header className="sticky top-0 z-10 -mx-4 bg-gradient-to-b from-[#faf8ff] via-[#faf8ff] to-transparent px-4 pb-4 pt-2">
        <div className="flex items-center justify-between">
          <Logo size={30} />
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span aria-live="polite">
              {saving ? 'Sauvegarde…' : `${answeredCount}/${allQuestions.length}`}
            </span>
            <span className="rounded-full bg-brand-100 px-2.5 py-1 font-semibold text-brand-700">
              ⭐ {favorites.size}/{data.favoritesRule.max}
            </span>
          </div>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-brand-100"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-rose-accent transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {data.readOnly && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <span aria-hidden className="text-lg">
            🔒
          </span>
          Cette session est fermée : tu peux consulter tes réponses, mais plus rien ne peut être
          modifié.
        </div>
      )}

      <main className="animate-fade-up" key={page.id}>
        <h2 className="mt-4 font-display text-2xl font-bold text-brand-900">{page.title}</h2>
        {page.description && <p className="mt-1 text-slate-500">{page.description}</p>}

        <div className="mt-6 space-y-4">
          {page.questions.map((q, i) => {
            const QuestionComponent = getQuestionComponent(q.type);
            const isFav = favorites.has(q.id);
            return (
              <div key={q.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-slate-800">
                    <span className="mr-2 text-sm font-bold text-brand-400">{i + 1}</span>
                    {q.prompt}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(q.id)}
                    disabled={data.readOnly}
                    aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    aria-pressed={isFav}
                    className={`shrink-0 rounded-full p-1.5 text-xl transition active:scale-90 disabled:pointer-events-none disabled:opacity-50 ${
                      isFav ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'
                    }`}
                  >
                    {isFav ? '★' : '☆'}
                  </button>
                </div>
                {q.helpText && <p className="mt-1 text-sm text-slate-500">{q.helpText}</p>}
                <div className={`mt-4 ${data.readOnly ? 'pointer-events-none opacity-60' : ''}`}>
                  <QuestionComponent
                    question={q}
                    value={answers[q.id]}
                    onChange={(value) => saveAnswer(q.id, value)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {error && <p className="mt-4 text-sm font-medium text-rose-600">{error}</p>}
      </main>

      {/* Navigation */}
      <footer
        className="fixed inset-x-0 bottom-0 border-t border-brand-100 bg-white/90 p-4 backdrop-blur"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
            disabled={pageIndex === 0}
          >
            ← Retour
          </button>
          <div className="flex-1 text-center text-sm text-slate-400">
            Page {pageIndex + 1}/{data.questionnaire.pages.length}
          </div>
          {data.readOnly ? (
            <button type="button" className="btn-primary" onClick={() => navigate('/session/report')}>
              Voir le rapport
            </button>
          ) : isLastPage ? (
            <button
              type="button"
              className="btn-primary"
              onClick={complete}
              disabled={!allAnswered || !favoritesOk || completing}
            >
              {completing ? 'Envoi…' : 'Terminer ✓'}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setPageIndex((i) => i + 1);
                window.scrollTo({ top: 0 });
              }}
            >
              Suivant →
            </button>
          )}
        </div>
        {!data.readOnly && isLastPage && (!allAnswered || !favoritesOk) && (
          <p className="mx-auto mt-2 max-w-2xl text-center text-xs text-slate-400">
            {!allAnswered
              ? `Il reste ${allQuestions.length - answeredCount} question(s) sans réponse.`
              : `Sélectionne au moins ${data.favoritesRule.min} favoris (⭐) pour terminer.`}
          </p>
        )}
      </footer>
    </div>
  );
}

function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6 text-slate-500">{children}</div>
  );
}
