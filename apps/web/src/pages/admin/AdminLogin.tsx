import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, tokens } from '../../api/client';
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
        setStep('2fa');
        setInfo('Ouvre Google Authenticator pour obtenir le code.');
      } else {
        tokens.set('admin', result.token);
        navigate(result.twoFactorSetupRequired ? '/admin/security' : '/admin');
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
        body: { pendingToken, code },
      });
      tokens.set('admin', result.token);
      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
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
              {loading ? 'Connexion...' : 'Continuer'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={submitCode} className="card w-full max-w-sm p-8 animate-fade-up">
          <Logo size={38} />
          <h1 className="mt-6 font-display text-2xl font-bold text-brand-900">
            Google Authenticator
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
            {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading || code.length !== 6}
            >
              {loading ? 'Vérification...' : 'Valider'}
            </button>
            <button
              type="button"
              className="btn-ghost w-full text-slate-500"
              onClick={() => setStep('password')}
            >
              Retour
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
