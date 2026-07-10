import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, tokens } from '../api/client';
import type { LoginChallenge, LoginSuccess } from '../types';

type Step = 'password' | '2fa';

export default function AdminLoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingToken, setPendingToken] = useState('');
  const [method, setMethod] = useState<'EMAIL_OTP' | 'TOTP'>('EMAIL_OTP');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setStep('password');
      setEmail('');
      setPassword('');
      setCode('');
      setError('');
      setInfo('');
    }
  }, [open]);

  if (!open) return null;

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api<LoginSuccess | LoginChallenge>('/api/admin/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      if ('requires2FA' in result) {
        setPendingToken(result.pendingToken);
        setMethod(result.method);
        setStep('2fa');
        setInfo(
          result.method === 'EMAIL_OTP'
            ? `Un code à 6 chiffres a été envoyé à ${email}.`
            : 'Ouvre ton application d’authentification pour obtenir le code.',
        );
      } else {
        tokens.set('admin', result.token);
        onClose();
        navigate('/admin');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api<LoginSuccess>('/api/admin/auth/verify-2fa', {
        method: 'POST',
        body: { pendingToken, code, rememberDevice },
      });
      tokens.set('admin', result.token);
      onClose();
      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError('');
    setInfo('');
    try {
      await api('/api/admin/auth/resend-otp', { method: 'POST', body: { pendingToken } });
      setInfo('Nouveau code envoyé.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-brand-900/40 backdrop-blur-sm sm:items-center animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Connexion administrateur"
    >
      <div
        className="card w-full max-w-sm rounded-b-none p-6 sm:rounded-3xl sm:p-8 animate-fade-up"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-start justify-between">
          <h2 className="font-display text-2xl font-bold text-brand-900">
            {step === 'password' ? 'Administration' : 'Vérification en deux étapes'}
          </h2>
          <button
            type="button"
            className="btn-ghost -mr-2 -mt-1 text-slate-400"
            onClick={onClose}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {step === 'password' ? (
          <form onSubmit={submitPassword} className="mt-5 space-y-4">
            <div>
              <label className="label" htmlFor="admin-email">
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="admin-password">
                Mot de passe
              </label>
              <input
                id="admin-password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Connexion…' : 'Continuer'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="mt-5 space-y-4">
            {info && <p className="text-sm text-slate-500">{info}</p>}
            <div>
              <label className="label" htmlFor="admin-code">
                Code à 6 chiffres
              </label>
              <input
                id="admin-code"
                className="input text-center text-2xl font-bold tracking-[0.4em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
                required
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
              />
              Mémoriser cet appareil
            </label>
            {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading || code.length !== 6}
            >
              {loading ? 'Vérification…' : 'Valider'}
            </button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                className="btn-ghost text-slate-400"
                onClick={() => setStep('password')}
              >
                ← Retour
              </button>
              {method === 'EMAIL_OTP' && (
                <button type="button" className="btn-ghost text-brand-700" onClick={resend}>
                  Renvoyer le code
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
