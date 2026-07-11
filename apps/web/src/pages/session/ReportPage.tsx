import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, tokens } from '../../api/client';
import type { ReportPayload, TrileanValue } from '../../types';
import ReportView from '../../components/report/ReportView';
import SignaturePad from '../../components/report/SignaturePad';
import ContractModal from '../../components/report/ContractModal';
import Logo from '../../components/Logo';
import ErrorPage from '../../components/ErrorPage';
import { PageSpinner } from '../../components/Skeleton';

export default function ReportPage() {
  const navigate = useNavigate();
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [showContract, setShowContract] = useState(false);

  const load = useCallback(() => {
    api<ReportPayload>('/api/public/me/report', { auth: 'participant' })
      .then(setPayload)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          tokens.clear('participant');
          navigate('/');
        } else {
          setError(err instanceof Error ? err.message : 'Erreur');
          setErrorStatus(err instanceof ApiError ? err.status : null);
        }
      });
  }, [navigate]);

  useEffect(() => {
    if (!tokens.get('participant')) {
      navigate('/');
      return;
    }
    load();
  }, [load, navigate]);

  // Le rapport, les réconciliations et les signatures doivent rester synchronisés
  // entre les deux participant·es sans rechargement manuel.
  useEffect(() => {
    if (!payload) return;
    const timer = setInterval(load, payload.ready ? 5000 : 8000);
    return () => clearInterval(timer);
  }, [payload, load]);

  if (error) {
    return (
      <ErrorPage
        variant={errorStatus === 403 ? '403' : '500'}
        detail={error}
        onRetry={() => {
          setError('');
          setErrorStatus(null);
          load();
        }}
      />
    );
  }

  if (!payload) {
    return <PageSpinner />;
  }

  if (!payload.ready) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center animate-fade-up">
        <Logo size={44} />
        <div className="card max-w-md p-8">
          <div className="text-4xl">⏳</div>
          <h1 className="mt-4 font-display text-2xl font-bold text-brand-900">
            Bien joué, ta partie est terminée !
          </h1>
          <p className="mt-3 text-slate-500">
            {payload.waitingFor && payload.waitingFor.length > 0
              ? `On attend ${payload.waitingFor.join(' et ')} pour générer votre rapport.`
              : "On attend l'autre participant pour générer votre rapport."}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Cette page se mettra à jour automatiquement.
          </p>
        </div>
      </div>
    );
  }

  const { report } = payload;
  if (!report) return null;

  async function saveSignature(image: string) {
    await api('/api/public/me/report/signature', {
      method: 'POST',
      body: { image },
      auth: 'participant',
    });
    load();
  }

  async function reconcile(questionId: string, value: TrileanValue) {
    await api('/api/public/me/report/reconcile', {
      method: 'POST',
      body: { questionId, value },
      auth: 'participant',
    });
    load();
  }

  const reconcilableDifferences = report.data.pages
    .flatMap((p) => p.results)
    .filter((r) => r.questionType === 'trilean' && r.kind === 'DIFFERENCE');
  const allParticipantsSigned = report.data.participants.every((participant) =>
    report.signatures.some((signature) => signature.participantId === participant.id),
  );
  const contractLockedReason =
    reconcilableDifferences.length > 0
      ? 'Réglez vos différences avant de voir le contrat.'
      : !allParticipantsSigned
        ? 'Le contrat sera disponible quand les 2 personnes auront signé.'
        : undefined;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-4xl px-4 py-8">
      <div className="no-print mb-6">
        <Logo size={34} />
      </div>
      <button
        type="button"
        onClick={() => !contractLockedReason && setShowContract(true)}
        disabled={Boolean(contractLockedReason)}
        title={contractLockedReason}
        className="no-print fixed right-16 top-3 z-40 flex h-11 items-center gap-2 rounded-full border border-brand-100 bg-surface px-4 text-sm font-semibold text-brand-700 shadow-lg transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span aria-hidden>📜</span> Voir le contrat
      </button>
      <ReportView
        code={report.code}
        score={report.score}
        generatedAt={report.generatedAt}
        data={report.data}
        signatures={report.signatures}
        myParticipantId={report.myParticipantId}
        signatureSlot={<SignaturePad onSave={saveSignature} />}
        onReconcile={reconcile}
      />
      {showContract && (
        <ContractModal
          code={report.code}
          score={report.score}
          generatedAt={report.generatedAt}
          data={report.data}
          signatures={report.signatures}
          myParticipantId={report.myParticipantId}
          onClose={() => setShowContract(false)}
        />
      )}
    </div>
  );
}
