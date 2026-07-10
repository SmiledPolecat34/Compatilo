import { useEffect, useState } from 'react';
import { apiUrl } from '../api/client';
import Logo from '../components/Logo';

interface HealthResponse {
  status: 'UP' | 'DOWN';
  database: 'UP' | 'DOWN';
  version: string;
  uptimeSeconds: number;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState('');
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  async function check() {
    setError('');
    try {
      const res = await fetch(apiUrl('/api/health'));
      const data = await res.json();
      setHealth(data);
    } catch {
      setError("Impossible de joindre l'API.");
      setHealth(null);
    } finally {
      setCheckedAt(new Date());
    }
  }

  useEffect(() => {
    check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, []);

  const rows: { label: string; value: string; ok: boolean }[] = health
    ? [
        { label: 'API', value: health.status, ok: health.status === 'UP' },
        { label: 'Base de données', value: health.database, ok: health.database === 'UP' },
        { label: 'Version', value: health.version, ok: true },
        { label: 'Disponible depuis', value: formatUptime(health.uptimeSeconds), ok: true },
      ]
    : [];

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="card w-full max-w-md p-8 animate-fade-up">
        <Logo size={40} />
        <h1 className="mt-6 font-display text-2xl font-bold text-brand-900">État du service</h1>

        {error && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <span aria-hidden>🔴</span> {error}
          </div>
        )}

        {health && (
          <div className="mt-5 space-y-2">
            {rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between rounded-xl border border-brand-100 px-4 py-3"
              >
                <span className="text-sm font-medium text-slate-600">{r.label}</span>
                <span
                  className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                    r.ok ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  <span aria-hidden>{r.ok ? '🟢' : '🔴'}</span>
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          {checkedAt && (
            <p className="text-xs text-slate-500" aria-live="polite">
              Vérifié à {checkedAt.toLocaleTimeString('fr-FR')}
            </p>
          )}
          <button type="button" className="btn-ghost text-sm text-brand-700" onClick={check}>
            Rafraîchir
          </button>
        </div>
      </div>
    </div>
  );
}
