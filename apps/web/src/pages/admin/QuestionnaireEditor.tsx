import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../../api/client';
import type { EditorPage, EditorQuestion } from '../../types';
import { Skeleton } from '../../components/Skeleton';
import { useToast } from '../../components/ToastProvider';

interface VersionPayload {
  id: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  questionnaire: { id: string; title: string };
  pages: {
    id: string;
    title: string;
    description: string | null;
    isActive: boolean;
    questions: {
      id: string;
      type: string;
      prompt: string;
      helpText: string | null;
      isActive: boolean;
      required: boolean;
      config: Record<string, unknown>;
    }[];
  }[];
}

let localCounter = 0;
const nextLocalId = () => `local-${++localCounter}`;

export default function QuestionnaireEditor() {
  const { versionId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [meta, setMeta] = useState<{ title: string; version: number; status: string } | null>(null);
  const [pages, setPages] = useState<EditorPage[]>([]);
  const [selectedPage, setSelectedPage] = useState(0);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  const [error, setError] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    api<VersionPayload>(`/api/admin/questionnaires/versions/${versionId}`, { auth: 'admin' })
      .then((v) => {
        setMeta({ title: v.questionnaire.title, version: v.version, status: v.status });
        setPages(
          v.pages.map((p) => ({
            id: p.id,
            localId: p.id,
            title: p.title,
            description: p.description,
            isActive: p.isActive,
            questions: p.questions.map((q) => ({
              id: q.id,
              localId: q.id,
              type: q.type,
              prompt: q.prompt,
              helpText: q.helpText,
              isActive: q.isActive,
              required: q.required,
              config: q.config ?? {},
            })),
          })),
        );
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Chargement impossible.'));
  }, [versionId, toast]);

  // Sauvegarde automatique (débounce) de la structure complète
  const scheduleSave = useCallback(
    (nextPages: EditorPage[]) => {
      setPages(nextPages);
      setSaveState('dirty');
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaveState('saving');
        try {
          const saved = await api<VersionPayload>(
            `/api/admin/questionnaires/versions/${versionId}/structure`,
            {
              method: 'PUT',
              auth: 'admin',
              body: {
                pages: nextPages.map((p) => ({
                  id: p.id,
                  title: p.title || 'Page sans titre',
                  description: p.description ?? null,
                  isActive: p.isActive,
                  questions: p.questions.map((q) => ({
                    id: q.id,
                    type: q.type,
                    prompt: q.prompt || 'Question sans intitulé',
                    helpText: q.helpText ?? null,
                    isActive: q.isActive,
                    required: q.required,
                    config: q.config,
                  })),
                })),
              },
            },
          );
          // Réconcilie les identifiants créés côté serveur
          setPages((current) =>
            current.map((p, pi) => {
              const savedPage = saved.pages[pi];
              if (!savedPage) return p;
              return {
                ...p,
                id: savedPage.id,
                questions: p.questions.map((q, qi) => ({
                  ...q,
                  id: savedPage.questions[qi]?.id ?? q.id,
                })),
              };
            }),
          );
          setSaveState('saved');
        } catch (err) {
          setSaveState('error');
          setError(err instanceof Error ? err.message : 'Erreur de sauvegarde');
        }
      }, 800);
    },
    [versionId],
  );

  const page = pages[selectedPage];

  const updatePage = (index: number, patch: Partial<EditorPage>) => {
    scheduleSave(pages.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const updateQuestion = (qIndex: number, patch: Partial<EditorQuestion>) => {
    updatePage(selectedPage, {
      questions: page.questions.map((q, i) => (i === qIndex ? { ...q, ...patch } : q)),
    });
  };

  function addPage() {
    const next = [
      ...pages,
      { localId: nextLocalId(), title: `Page ${pages.length + 1}`, isActive: true, questions: [] },
    ];
    scheduleSave(next);
    setSelectedPage(next.length - 1);
  }

  function removePage(index: number) {
    if (!window.confirm('Supprimer cette page et toutes ses questions ?')) return;
    scheduleSave(pages.filter((_, i) => i !== index));
    setSelectedPage((s) => Math.max(0, Math.min(s, pages.length - 2)));
  }

  function movePage(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= pages.length) return;
    scheduleSave(arrayMove(pages, index, target));
    setSelectedPage(target);
  }

  function addQuestion() {
    updatePage(selectedPage, {
      questions: [
        ...page.questions,
        {
          localId: nextLocalId(),
          type: 'trilean',
          prompt: '',
          isActive: true,
          required: true,
          config: {},
        },
      ],
    });
  }

  function onQuestionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = page.questions.findIndex((q) => q.localId === active.id);
    const to = page.questions.findIndex((q) => q.localId === over.id);
    updatePage(selectedPage, { questions: arrayMove(page.questions, from, to) });
  }

  async function publish() {
    if (!window.confirm('Publier cette version ? Elle ne sera plus modifiable.')) return;
    try {
      await api(`/api/admin/questionnaires/versions/${versionId}/publish`, {
        method: 'POST',
        auth: 'admin',
      });
      toast.success('Version publiée.');
      navigate('/admin/questionnaires');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  }

  const questionIds = useMemo(() => page?.questions.map((q) => q.localId) ?? [], [page]);

  if (!meta) {
    return (
      <div className="animate-fade-up space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <Link to="/admin/questionnaires" className="btn-ghost mb-4 inline-flex">
        ← Questionnaires
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">
            {meta.title} — v{meta.version}
          </h1>
          <p className="text-sm text-slate-500" aria-live="polite">
            {saveState === 'saved' && 'Brouillon enregistré ✓'}
            {saveState === 'dirty' && 'Modifications en attente…'}
            {saveState === 'saving' && 'Enregistrement…'}
            {saveState === 'error' && <span className="text-rose-500">{error}</span>}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={publish}>
          Publier cette version
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Liste des pages */}
        <aside className="card h-fit p-4">
          <h2 className="mb-3 px-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            Pages
          </h2>
          <ul className="space-y-1">
            {pages.map((p, i) => (
              <li key={p.localId}>
                <button
                  type="button"
                  onClick={() => setSelectedPage(i)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                    i === selectedPage
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-600 hover:bg-brand-50'
                  } ${p.isActive ? '' : 'opacity-50'}`}
                >
                  <span className="truncate">{p.title || 'Sans titre'}</span>
                  <span className="ml-2 shrink-0 text-xs opacity-70">{p.questions.length}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-secondary mt-3 w-full" onClick={addPage}>
            + Ajouter une page
          </button>
        </aside>

        {/* Édition de la page sélectionnée */}
        {page ? (
          <main className="space-y-5">
            <div className="card space-y-4 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="input flex-1 font-semibold"
                  value={page.title}
                  onChange={(e) => updatePage(selectedPage, { title: e.target.value })}
                  placeholder="Titre de la page"
                  aria-label="Titre de la page"
                />
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => movePage(selectedPage, -1)}
                  disabled={selectedPage === 0}
                  aria-label="Monter la page"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => movePage(selectedPage, 1)}
                  disabled={selectedPage === pages.length - 1}
                  aria-label="Descendre la page"
                >
                  ↓
                </button>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-600"
                    checked={page.isActive}
                    onChange={(e) => updatePage(selectedPage, { isActive: e.target.checked })}
                  />
                  Active
                </label>
                <button
                  type="button"
                  className="btn-ghost text-rose-500"
                  onClick={() => removePage(selectedPage)}
                >
                  Supprimer
                </button>
              </div>
              <input
                className="input"
                value={page.description ?? ''}
                onChange={(e) => updatePage(selectedPage, { description: e.target.value })}
                placeholder="Description (optionnelle)"
                aria-label="Description de la page"
              />
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onQuestionDragEnd}>
              <SortableContext items={questionIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {page.questions.map((q, qi) => (
                    <SortableQuestion
                      key={q.localId}
                      question={q}
                      onChange={(patch) => updateQuestion(qi, patch)}
                      onRemove={() =>
                        updatePage(selectedPage, {
                          questions: page.questions.filter((_, i) => i !== qi),
                        })
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <button type="button" className="btn-secondary w-full" onClick={addQuestion}>
              + Ajouter une question
            </button>
          </main>
        ) : (
          <div className="card p-10 text-center text-slate-500">
            Ajoute une première page pour commencer.
          </div>
        )}
      </div>
    </div>
  );
}

function SortableQuestion({
  question,
  onChange,
  onRemove,
}: {
  question: EditorQuestion;
  onChange: (patch: Partial<EditorQuestion>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.localId,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`card p-4 ${isDragging ? 'z-10 shadow-2xl' : ''} ${question.isActive ? '' : 'opacity-60'}`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="mt-2 cursor-grab touch-none text-lg text-slate-300 active:cursor-grabbing"
          aria-label="Déplacer la question"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <div className="flex-1 space-y-3">
          <input
            className="input"
            value={question.prompt}
            onChange={(e) => onChange({ prompt: e.target.value })}
            placeholder="Intitulé de la question"
            aria-label="Intitulé de la question"
          />
          <input
            className="input"
            value={question.helpText ?? ''}
            onChange={(e) => onChange({ helpText: e.target.value || null })}
            placeholder="Texte d'aide (optionnel)"
            aria-label="Texte d'aide"
          />
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
            <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
              Oui / Possible / Non
            </span>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={question.isActive}
                onChange={(e) => onChange({ isActive: e.target.checked })}
              />
              Active
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={question.required}
                onChange={(e) => onChange({ required: e.target.checked })}
              />
              Obligatoire
            </label>
            <button type="button" className="btn-ghost text-rose-500" onClick={onRemove}>
              Supprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
