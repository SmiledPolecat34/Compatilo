import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, tokens } from '../../api/client';
import type { LoginChallenge, LoginSuccess } from '../../types';
import Logo from '../../components/Logo';

type Step = 'password' | '2fa';

export default function AdminLogin() {
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
        body: { pendingToken, code, rememberDevice: method === 'EMAIL_OTP' && rememberDevice },
      });
      tokens.set('admin', result.token);
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
      setError(err instanceof ApiError ? err.message : 'Erreur');
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      {step === 'password' ? (
        <form onSubmit={submitPassword} className="card w-full max-w-sm p-8 animate-fade-up">
          <Logo size={38} />
          <h1 className="mt-6 font-display text-2xl font-bold text-brand-900">Administration</h1>
          <div className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Mot de passe
              </label>
              <input
                id="password"
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
          </div>
        </form>
      ) : (
        <form onSubmit={submitCode} className="card w-full max-w-sm p-8 animate-fade-up">
          <Logo size={38} />
          <h1 className="mt-6 font-display text-2xl font-bold text-brand-900">
            Vérification en deux étapes
          </h1>
          {info && <p className="mt-2 text-sm text-slate-500">{info}</p>}
          <div className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="code">
                Code à 6 chiffres
              </label>
              <input
                id="code"
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
            {method === 'EMAIL_OTP' && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
              />
              Mémoriser cet appareil
              </label>
            )}
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
                className="btn-ghost text-slate-500"
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
          </div>
        </form>
      )}
    </div>
  );
}
