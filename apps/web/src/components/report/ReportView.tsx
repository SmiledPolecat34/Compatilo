import { useState, type ReactNode } from 'react';
import type { MatchKind, ReportData, TrileanValue } from '../../types';
import ScoreDonut from './ScoreDonut';

const VALUE_LABEL: Record<TrileanValue, string> = { YES: 'Oui', POSSIBLE: 'Possible', NO: 'Non' };
const VALUE_STYLE: Record<TrileanValue, string> = {
  YES: 'bg-emerald-100 text-emerald-700',
  POSSIBLE: 'bg-amber-100 text-amber-700',
  NO: 'bg-rose-100 text-rose-700',
};
const KIND_META: Record<MatchKind, { label: string; dot: string }> = {
  MATCH: { label: 'Compatible', dot: 'bg-emerald-400' },
  PARTIAL: { label: 'Compatible partielle', dot: 'bg-amber-400' },
  DIFFERENCE: { label: 'Différence', dot: 'bg-rose-400' },
};

export interface ReportViewProps {
  code: string;
  score: number;
  generatedAt: string;
  data: ReportData;
  signatures: { participantId: string; image: string; signedAt: string }[];
  signatureSlot?: ReactNode; // zone de signature pour le participant courant
  myParticipantId?: string;
  /** Fourni côté participant : permet de se mettre d'accord sur une différence trilean. */
  onReconcile?: (questionId: string, value: TrileanValue) => Promise<void>;
}

export default function ReportView({
  code,
  score,
  generatedAt,
  data,
  signatures,
  signatureSlot,
  myParticipantId,
  onReconcile,
}: ReportViewProps) {
  const date = new Date(generatedAt);
  const [a, b] = data.participants;
  const questionById = new Map(
    data.pages.flatMap((p) => p.results.map((r) => [r.questionId, r] as const)),
  );

  const differences = data.pages.flatMap((p) =>
    p.results.filter((r) => r.kind === 'DIFFERENCE').map((r) => ({ ...r, pageTitle: p.title })),
  );
  const reconcilableDifferences = differences.filter((r) => r.questionType === 'trilean');
  const commons = data.pages.flatMap((p) =>
    p.results.filter((r) => r.kind === 'MATCH').map((r) => ({ ...r, pageTitle: p.title })),
  );
  // Infos perso, réseaux, date de naissance, ville, origines : pas de vraie
  // "compatibilité" à afficher, ce sont des pages sans réponse comparable.
  const themedPages = data.pages.filter((p) => p.results.some((r) => r.kind !== null));

  return (
    <article className="card print-page mx-auto w-full max-w-3xl overflow-hidden">
      {/* En-tête */}
      <header className="bg-gradient-to-br from-brand-700 via-brand-600 to-rose-accent px-6 py-10 text-center text-white sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/70">
          Rapport de compatibilité
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
          {a.firstName} & {b.firstName}
        </h1>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-white/80">
          <span>{code}</span>
          <span aria-hidden>·</span>
          <span>
            {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <span aria-hidden>·</span>
          <span>{date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </header>

      <div className="space-y-10 px-6 py-10 sm:px-10">
        {/* Score + tags */}
        <section className="flex flex-col items-center gap-6">
          <ScoreDonut score={score} />
          <div className="flex flex-wrap justify-center gap-2">
            {data.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-brand-100 px-4 py-1.5 text-sm font-semibold text-brand-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* Sommaire */}
        <nav aria-label="Sommaire du rapport" className="rounded-2xl border border-brand-100 bg-surface p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-400">Sommaire</p>
          <ul className="flex snap-x gap-3 overflow-x-auto pb-2 text-sm sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
            {[
              { href: '#theme', label: 'Compatibilité par thème' },
              { href: '#profils', label: 'Cartes de profil' },
              { href: '#communs', label: 'Vos points communs', count: commons.length },
              { href: '#differences', label: 'Vos différences', count: differences.length },
              { href: '#toutes-reponses', label: 'Toutes les réponses' },
              { href: '#signatures', label: 'Signatures' },
            ].map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="flex min-w-44 snap-start items-center justify-between gap-2 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 font-semibold text-brand-700 transition hover:-translate-y-0.5 hover:bg-brand-100 sm:min-w-0"
                >
                  <span>{item.label}</span>
                  {item.count !== undefined && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                      {item.count}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Résumé intelligent */}
        <section>
          <SectionTitle>En résumé</SectionTitle>
          <p className="leading-relaxed text-slate-600">{data.summary}</p>
        </section>

        {/* Graphique par thème */}
        <section id="theme" className="scroll-mt-20">
          <SectionTitle>Compatibilité par thème</SectionTitle>
          <div className="space-y-3">
            {themedPages.map((p) => (
              <div key={p.pageId}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="font-semibold text-slate-700">{p.title}</span>
                  <span className="font-bold text-brand-700">{p.score}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-brand-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-rose-accent"
                    style={{ width: `${p.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Cartes profils + favoris */}
        <section id="profils" className="scroll-mt-20">
          <SectionTitle>Cartes de profil</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.participants.map((p) => (
              <div
                key={p.id}
                className="rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 to-rose-50 p-6"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-2xl font-bold text-brand-600 shadow-sm">
                  {p.firstName.charAt(0).toUpperCase()}
                </div>
                <h3 className="mt-3 font-display text-xl font-bold text-brand-900">
                  {p.firstName}
                  {p.nickname && (
                    <span className="ml-2 text-base font-medium text-slate-500">
                      « {p.nickname} »
                    </span>
                  )}
                </h3>
                {p.city && <p className="text-sm text-slate-500">📍 {p.city}</p>}
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-400">
                    💜 Le plus important sur toi
                  </p>
                  {p.favorites.length === 0 && <p className="text-sm text-slate-500">Aucun élément sélectionné.</p>}
                  {p.favorites.map((qid) => {
                    const q = questionById.get(qid);
                    if (!q) return null;
                    const value = p.slot === 1 ? q.valueA : q.valueB;
                    return (
                      <div
                        key={qid}
                        className="rounded-xl px-3 py-2 text-sm"
                        style={{ backgroundColor: 'color-mix(in oklab, var(--surface-solid) 80%, transparent)' }}
                      >
                        <span className="text-slate-700">{q.prompt}</span>
                        {value && (
                          <span
                            className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${VALUE_STYLE[value]}`}
                          >
                            {VALUE_LABEL[value]}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Réponses communes */}
        <section id="communs" className="scroll-mt-20">
          <SectionTitle>
            Vos points communs <span className="text-slate-500">({commons.length})</span>
          </SectionTitle>
          <AnswerList items={commons.slice(0, 12)} a={a.firstName} b={b.firstName} />
        </section>

        {/* Différences */}
        <section id="differences" className="scroll-mt-20">
          <SectionTitle>
            Vos différences <span className="text-slate-500">({differences.length})</span>
          </SectionTitle>
          {differences.length === 0 ? (
            <p className="text-slate-500">Aucune vraie différence — impressionnant ! 🎉</p>
          ) : (
            <>
              {onReconcile && reconcilableDifferences.length > 0 && (
                <p className="mb-3 text-sm text-slate-500">
                  Mettez-vous d'accord sur une réponse commune pour pouvoir signer et télécharger
                  le contrat.
                </p>
              )}
              <div className="space-y-2">
                {differences.map((r) => (
                  <div key={r.questionId} className="rounded-2xl border border-brand-100 bg-surface px-4 py-3">
                    <p className="text-sm font-medium text-slate-700">{r.prompt}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {r.pageTitle} — {a.firstName} :{' '}
                      <strong>{r.valueA ? VALUE_LABEL[r.valueA] : '—'}</strong> · {b.firstName} :{' '}
                      <strong>{r.valueB ? VALUE_LABEL[r.valueB] : '—'}</strong>
                    </p>
                    {onReconcile && r.questionType === 'trilean' && (
                      <ReconcileControls questionId={r.questionId} onReconcile={onReconcile} />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Détail complet */}
        <section id="toutes-reponses" className="scroll-mt-20">
          <SectionTitle>Toutes les réponses</SectionTitle>
          <div className="space-y-6">
            {data.pages.map((p) => (
              <div key={p.pageId}>
                <h3 className="mb-2 font-semibold text-brand-800">{p.title}</h3>
                <div className="overflow-hidden rounded-2xl border border-brand-100">
                  {p.results.map((r, i) => (
                    <div
                      key={r.questionId}
                      className={`flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center ${
                        i % 2 ? 'bg-brand-50/50' : 'bg-surface'
                      }`}
                    >
                      <span className="flex-1 text-slate-700">
                        {(r.isFavoriteA || r.isFavoriteB) && <span aria-hidden>💜 </span>}
                        {r.prompt}
                      </span>
                      <span className="flex items-center gap-2">
                        {r.valueA && (
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${VALUE_STYLE[r.valueA]}`}>
                            {VALUE_LABEL[r.valueA]}
                          </span>
                        )}
                        {r.valueB && (
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${VALUE_STYLE[r.valueB]}`}>
                            {VALUE_LABEL[r.valueB]}
                          </span>
                        )}
                        {r.kind && (
                          <span className="flex items-center gap-1.5 text-xs text-slate-500">
                            <span className={`h-2 w-2 rounded-full ${KIND_META[r.kind].dot}`} />
                            {KIND_META[r.kind].label}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Signatures */}
        <section id="signatures" className="scroll-mt-20">
          <SectionTitle>Signatures</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.participants.map((p) => {
              const sig = signatures.find((s) => s.participantId === p.id);
              const isMe = p.id === myParticipantId;
              return (
                <div key={p.id} className="rounded-2xl border border-brand-100 p-4">
                  <p className="mb-2 text-sm font-semibold text-slate-600">{p.firstName}</p>
                  {sig ? (
                    <img
                      src={sig.image}
                      alt={`Signature de ${p.firstName}`}
                      className="h-24 object-contain"
                    />
                  ) : isMe && signatureSlot ? (
                    reconcilableDifferences.length > 0 ? (
                      <p className="flex h-24 items-center justify-center px-2 text-center text-sm text-rose-600">
                        Réglez vos {reconcilableDifferences.length} différence(s) avant de signer.
                      </p>
                    ) : (
                      signatureSlot
                    )
                  ) : (
                    <p className="flex h-24 items-center justify-center text-sm text-slate-500">
                      En attente de signature…
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Pied de rapport */}
        <footer className="flex flex-col items-center gap-3 border-t border-brand-100 pt-8 text-center">
          <p className="text-xs text-slate-500">
            Rapport {code} — généré par Compatilo le{' '}
            {date.toLocaleDateString('fr-FR')} à{' '}
            {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </footer>
      </div>
    </article>
  );
}

const RECONCILE_OPTIONS: { value: TrileanValue; label: string }[] = [
  { value: 'YES', label: 'Oui' },
  { value: 'POSSIBLE', label: 'Possible' },
  { value: 'NO', label: 'Non' },
];

function ReconcileControls({
  questionId,
  onReconcile,
}: {
  questionId: string;
  onReconcile: (questionId: string, value: TrileanValue) => Promise<void>;
}) {
  const [loading, setLoading] = useState<TrileanValue | null>(null);

  async function pick(value: TrileanValue) {
    setLoading(value);
    try {
      await onReconcile(questionId, value);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-brand-100 pt-3">
      <span className="text-xs font-semibold text-slate-500">On tombe d'accord sur :</span>
      {RECONCILE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => pick(opt.value)}
          disabled={loading !== null}
          className="rounded-full border border-brand-200 px-3 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"
        >
          {loading === opt.value ? '…' : opt.label}
        </button>
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 font-display text-xl font-bold text-brand-900">{children}</h2>
  );
}

function AnswerList({
  items,
  a,
  b,
}: {
  items: (ReportData['pages'][number]['results'][number] & { pageTitle: string })[];
  a: string;
  b: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((r) => (
        <div key={r.questionId} className="rounded-2xl border border-brand-100 bg-surface px-4 py-3">
          <p className="text-sm font-medium text-slate-700">{r.prompt}</p>
          <p className="mt-1 text-xs text-slate-500">
            {r.pageTitle} — {a} :{' '}
            <strong>{r.valueA ? VALUE_LABEL[r.valueA] : '—'}</strong> · {b} :{' '}
            <strong>{r.valueB ? VALUE_LABEL[r.valueB] : '—'}</strong>
          </p>
        </div>
      ))}
    </div>
  );
}
