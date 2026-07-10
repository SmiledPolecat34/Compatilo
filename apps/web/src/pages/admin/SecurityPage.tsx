import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { api, tokens } from '../../api/client';
import type { TwoFactorStatus } from '../../types';
import { Skeleton } from '../../components/Skeleton';
import { useToast } from '../../components/ToastProvider';

export default function SecurityPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    api<TwoFactorStatus>('/api/admin/auth/2fa', { auth: 'admin' })
      .then(setStatus)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Chargement impossible.'));
  }, [toast]);

  useEffect(load, [load]);

  async function startEnrollment() {
    setError('');
    setCode('');
    try {
      const { secret: s, otpauthUrl } = await api<{ secret: string; otpauthUrl: string }>(
        '/api/admin/auth/2fa/totp/setup',
        { method: 'POST', auth: 'admin' },
      );
      setSecret(s);
      setQrDataUrl(await QRCode.toDataURL(otpauthUrl, { width: 220, margin: 1 }));
      setEnrolling(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  async function confirmEnrollment() {
    setLoading(true);
    setError('');
    try {
      await api('/api/admin/auth/2fa/totp/enable', { method: 'POST', body: { code }, auth: 'admin' });
      setEnrolling(false);
      setCode('');
      toast.success('Google Authenticator activé.');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  async function revokeAll() {
    if (
      !window.confirm(
        'Déconnecter tous les appareils (y compris celui-ci) ? Une nouvelle connexion sera nécessaire.',
      )
    )
      return;
    try {
      await api('/api/admin/auth/revoke-all', { method: 'POST', auth: 'admin' });
      tokens.clear('admin');
      navigate('/admin/login');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    }
  }

  if (!status) {
    return (
      <div className="animate-fade-up space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-5 sm:space-y-6">
      <h1 className="font-display text-2xl font-bold text-brand-900 sm:text-3xl">Sécurité</h1>

      <section className="card p-4 sm:p-6">
        <h2 className="font-display text-lg font-bold text-brand-900">
          Authentification à deux facteurs
        </h2>
        <p className="mt-1 text-sm text-slate-500">Méthode active : Google Authenticator</p>

        {enrolling ? (
          <div className="mt-4 max-w-sm space-y-3">
            <p className="text-sm text-slate-600">
              Scanne ce QR code avec Google Authenticator, Authy ou une app compatible TOTP.
            </p>
            {qrDataUrl && <img src={qrDataUrl} alt="QR code Google Authenticator" className="h-auto max-w-full rounded-lg" />}
            <p className="break-all rounded-lg bg-brand-50 p-2 text-xs text-slate-500">{secret}</p>
            <input
              className="input text-center text-xl font-bold tracking-[0.3em]"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
            />
            {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
            <div className="grid gap-2 sm:flex">
              <button type="button" className="btn-ghost" onClick={() => setEnrolling(false)}>
                Annuler
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={confirmEnrollment}
                disabled={loading || code.length !== 6}
              >
                Activer
              </button>
            </div>
          </div>
        ) : status.totpEnabled ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-600">
              Google Authenticator est activé pour les connexions administrateur.
            </p>
            <button type="button" className="btn-secondary" onClick={startEnrollment}>
              Reconfigurer Google Authenticator
            </button>
          </div>
        ) : (
          <button type="button" className="btn-primary mt-4" onClick={startEnrollment}>
            Activer Google Authenticator
          </button>
        )}
      </section>

      <section className="card p-4 sm:p-6">
        <h2 className="font-display text-lg font-bold text-brand-900">Sessions actives</h2>
        <p className="mt-1 text-sm text-slate-500">
          En cas de doute (appareil perdu, accès partagé), invalide immédiatement tous les jetons
          de connexion déjà émis, y compris celui utilisé sur cet appareil.
        </p>
        <button type="button" className="btn-ghost mt-4 text-rose-500" onClick={revokeAll}>
          Se déconnecter de tous les appareils
        </button>
      </section>
    </div>
  );
}
