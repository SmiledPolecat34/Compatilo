import { useEffect, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
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
}

export default function ReportView({
  code,
  score,
  generatedAt,
  data,
  signatures,
  signatureSlot,
  myParticipantId,
}: ReportViewProps) {
  const [qrUrl, setQrUrl] = useState('');
  const date = new Date(generatedAt);

  useEffect(() => {
    QRCode.toDataURL(window.location.origin, {
      width: 160,
      margin: 1,
      color: { dark: '#481f79', light: '#ffffff00' },
    }).then(setQrUrl);
  }, []);

  const [a, b] = data.participants;
  const questionById = new Map(
    data.pages.flatMap((p) => p.results.map((r) => [r.questionId, r] as const)),
  );

  const differences = data.pages.flatMap((p) =>
    p.results.filter((r) => r.kind === 'DIFFERENCE').map((r) => ({ ...r, pageTitle: p.title })),
  );
  const commons = data.pages.flatMap((p) =>
    p.results.filter((r) => r.kind === 'MATCH').map((r) => ({ ...r, pageTitle: p.title })),
  );

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

        {/* Résumé intelligent */}
        <section>
          <SectionTitle>En résumé</SectionTitle>
          <p className="leading-relaxed text-slate-600">{data.summary}</p>
        </section>

        {/* Graphique par thème */}
        <section>
          <SectionTitle>Compatibilité par thème</SectionTitle>
          <div className="space-y-3">
            {data.pages.map((p) => (
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
        <section>
          <SectionTitle>Cartes de profil</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.participants.map((p) => (
              <div
                key={p.id}
                className="rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 to-rose-50 p-6"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl font-bold text-brand-600 shadow-sm">
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
                    ⭐ Ses favoris
                  </p>
                  {p.favorites.map((qid) => {
                    const q = questionById.get(qid);
                    if (!q) return null;
                    const value = p.slot === 1 ? q.valueA : q.valueB;
                    return (
                      <div key={qid} className="rounded-xl bg-white/80 px-3 py-2 text-sm">
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
        <section>
          <SectionTitle>
            Vos points communs <span className="text-slate-400">({commons.length})</span>
          </SectionTitle>
          <AnswerList items={commons.slice(0, 12)} a={a.firstName} b={b.firstName} />
        </section>

        {/* Différences */}
        <section>
          <SectionTitle>
            Vos différences <span className="text-slate-400">({differences.length})</span>
          </SectionTitle>
          {differences.length === 0 ? (
            <p className="text-slate-500">Aucune vraie différence — impressionnant ! 🎉</p>
          ) : (
            <AnswerList items={differences} a={a.firstName} b={b.firstName} />
          )}
        </section>

        {/* Détail complet */}
        <section>
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
                        i % 2 ? 'bg-brand-50/50' : 'bg-white'
                      }`}
                    >
                      <span className="flex-1 text-slate-700">
                        {(r.isFavoriteA || r.isFavoriteB) && <span aria-hidden>⭐ </span>}
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
                          <span className="flex items-center gap-1.5 text-xs text-slate-400">
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
        <section>
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
                    signatureSlot
                  ) : (
                    <p className="flex h-24 items-center justify-center text-sm text-slate-400">
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
          {qrUrl && <img src={qrUrl} alt="QR code Compatilo" width={110} height={110} />}
          <p className="text-xs text-slate-400">
            Rapport {code} — généré par Compatilo le{' '}
            {date.toLocaleDateString('fr-FR')} à{' '}
            {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </footer>
      </div>
    </article>
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
        <div key={r.questionId} className="rounded-2xl border border-brand-100 bg-white px-4 py-3">
          <p className="text-sm font-medium text-slate-700">{r.prompt}</p>
          <p className="mt-1 text-xs text-slate-400">
            {r.pageTitle} — {a} :{' '}
            <strong>{r.valueA ? VALUE_LABEL[r.valueA] : '—'}</strong> · {b} :{' '}
            <strong>{r.valueB ? VALUE_LABEL[r.valueB] : '—'}</strong>
          </p>
        </div>
      ))}
    </div>
  );
}
