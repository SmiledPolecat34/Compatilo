import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, tokens } from '../../api/client';
import type { ReportPayload } from '../../types';
import ReportView from '../../components/report/ReportView';
import SignaturePad from '../../components/report/SignaturePad';
import Logo from '../../components/Logo';

export default function ReportPage() {
  const navigate = useNavigate();
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<ReportPayload>('/api/public/me/report', { auth: 'participant' })
      .then(setPayload)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          tokens.clear('participant');
          navigate('/');
        } else {
          setError(err instanceof Error ? err.message : 'Erreur');
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

  // L'autre participant n'a pas terminé : on vérifie régulièrement
  useEffect(() => {
    if (payload && !payload.ready) {
      const timer = setInterval(load, 8000);
      return () => clearInterval(timer);
    }
  }, [payload, load]);

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <Logo size={40} />
        <p className="text-slate-600">{error}</p>
        <button type="button" className="btn-secondary" onClick={() => navigate('/')}>
          Retour à l'accueil
        </button>
      </div>
    );
  }

  if (!payload) {
    return <div className="flex min-h-dvh items-center justify-center text-slate-500">Chargement…</div>;
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
          <p className="mt-2 text-sm text-slate-400">
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

  return (
    <div className="mx-auto min-h-dvh w-full max-w-4xl px-4 py-8">
      <div className="no-print mb-6 flex items-center justify-between">
        <Logo size={34} />
        <button type="button" className="btn-secondary" onClick={() => window.print()}>
          Exporter en PDF
        </button>
      </div>
      <ReportView
        code={report.code}
        score={report.score}
        generatedAt={report.generatedAt}
        data={report.data}
        signatures={report.signatures}
        myParticipantId={report.myParticipantId}
        signatureSlot={<SignaturePad onSave={saveSignature} />}
      />
    </div>
  );
}
