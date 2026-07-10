import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { api, tokens } from '../../api/client';
import type { TwoFactorStatus } from '../../types';

export default function SecurityPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    api<TwoFactorStatus>('/api/admin/auth/2fa', { auth: 'admin' }).then(setStatus);
  }, []);

  useEffect(load, [load]);

  async function startEnrollment() {
    setError('');
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
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  async function disableTotp() {
    if (!window.confirm('Revenir au code envoyé par e-mail comme méthode de connexion ?')) return;
    await api('/api/admin/auth/2fa/totp/disable', { method: 'POST', auth: 'admin' });
    load();
  }

  async function revokeDevice(id: string) {
    await api(`/api/admin/auth/2fa/trusted-devices/${id}`, { method: 'DELETE', auth: 'admin' });
    load();
  }

  async function revokeAll() {
    if (
      !window.confirm(
        'Déconnecter tous les appareils (y compris celui-ci) ? Une nouvelle connexion sera nécessaire.',
      )
    )
      return;
    await api('/api/admin/auth/revoke-all', { method: 'POST', auth: 'admin' });
    tokens.clear('admin');
    navigate('/admin/login');
  }

  if (!status) return <div className="p-10 text-center text-slate-500">Chargement…</div>;

  return (
    <div className="animate-fade-up space-y-6">
      <h1 className="font-display text-3xl font-bold text-brand-900">Sécurité</h1>

      <section className="card p-6">
        <h2 className="font-display text-lg font-bold text-brand-900">
          Authentification à deux facteurs
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Méthode active : {status.method === 'TOTP' ? 'application d’authentification' : 'code par e-mail'}
        </p>

        {status.totpEnabled ? (
          <button type="button" className="btn-secondary mt-4" onClick={disableTotp}>
            Désactiver l'application d'authentification
          </button>
        ) : enrolling ? (
          <div className="mt-4 max-w-sm space-y-3">
            <p className="text-sm text-slate-600">
              Scanne ce QR code avec Google Authenticator, Authy ou une app compatible TOTP.
            </p>
            {qrDataUrl && <img src={qrDataUrl} alt="QR code d'enrôlement TOTP" className="rounded-xl" />}
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
            <div className="flex gap-2">
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
        ) : (
          <button type="button" className="btn-primary mt-4" onClick={startEnrollment}>
            Activer une application d'authentification
          </button>
        )}
      </section>

      <section className="card p-6">
        <h2 className="font-display text-lg font-bold text-brand-900">Appareils de confiance</h2>
        <p className="mt-1 text-sm text-slate-500">
          Mémorisés jusqu'à {status.trustedDeviceDays} jours — le 2FA est sauté sur ces appareils.
        </p>
        {status.trustedDevices.length === 0 ? (
          <p className="mt-4 text-slate-500">Aucun appareil mémorisé.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {status.trustedDevices.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-xl border border-brand-100 p-3 text-sm">
                <div>
                  <p className="font-medium text-slate-700">{d.label || 'Appareil inconnu'}</p>
                  <p className="text-xs text-slate-400">
                    Dernière utilisation : {new Date(d.lastUsedAt).toLocaleString('fr-FR')}
                  </p>
                </div>
                <button type="button" className="btn-ghost text-rose-500" onClick={() => revokeDevice(d.id)}>
                  Révoquer
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-6">
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
