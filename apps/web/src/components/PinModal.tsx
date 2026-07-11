import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, tokens } from '../api/client';
import { useEscapeToClose } from '../hooks/useEscapeToClose';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface CheckResult {
  label: string | null;
  completed: boolean;
  reportAccessEnabled: boolean;
  participants: {
    slot: number;
    firstName: string;
    nickname: string | null;
    completed: boolean;
    isAdmin: boolean;
  }[];
}

interface EnterResult {
  token: string;
  participant: { id: string; slot: number; firstName: string; completed: boolean };
}

type Step = 'pin' | 'profile';

export default function PinModal({
  open,
  initialPin,
  onClose,
}: {
  open: boolean;
  initialPin: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('pin');
  const [pin, setPin] = useState(initialPin);
  const [firstName, setFirstName] = useState('');
  const [shareLocation, setShareLocation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setPin(initialPin);
      setStep('pin');
      setError('');
    }
  }, [open, initialPin]);

  useEscapeToClose(open, onClose);
  useBodyScrollLock(open);

  if (!open) return null;

  async function verifyPin() {
    if (!/^\d{6}$/.test(pin)) {
      setError('Le code PIN contient 6 chiffres.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api<CheckResult>('/api/public/join/check', {
        method: 'POST',
        body: { pin },
      });
      // Sur le site public, on est toujours l'invité·e : l'admin rejoint
      // depuis son panel. Si l'invité·e a déjà un slot, on le reprend
      // directement, sans jamais demander "qui es-tu ?".
      const guest = result.participants.find((p) => !p.isAdmin);
      if (guest) {
        await enter(guest.slot);
      } else {
        setStep('profile');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  async function enter(slot?: number) {
    if (!slot && firstName.trim().length < 3) {
      setError('Le prénom doit contenir au moins 3 caractères.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      let city: string | undefined;

      if (!slot && shareLocation && 'geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 }),
          );
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
          const geo = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=fr`,
          ).then((r) => r.json());
          city = geo.city || geo.locality || undefined;
        } catch {
          // Localisation refusée ou indisponible : on continue sans
        }
      }

      const result = await api<EnterResult>('/api/public/join/enter', {
        method: 'POST',
        body: slot
          ? { pin, slot }
          : {
              pin,
              firstName: firstName.trim(),
              locationConsent: shareLocation,
              latitude,
              longitude,
              city,
            },
      });
      tokens.set('participant', result.token);
      navigate(result.participant.completed ? '/session/report' : '/session');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Rejoindre une session"
    >
      <div
        ref={dialogRef}
        className="card max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-lg p-4 sm:p-8 animate-fade-up"
      >
        <div className="flex items-start justify-between">
          <h2 className="font-display text-2xl font-bold text-brand-900">
            {step === 'pin' && 'Code PIN'}
            {step === 'profile' && 'Fais-toi connaître'}
          </h2>
          <button type="button" className="btn-ghost -mr-2 -mt-1 text-slate-500" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        {step === 'pin' && (
          <div className="mt-5">
            <p className="text-slate-500">Entre le code à 6 chiffres reçu dans ton invitation.</p>
            <input
              className="input mt-4 text-center text-2xl font-bold tracking-[0.35em] sm:text-3xl sm:tracking-[0.5em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && verifyPin()}
              placeholder="••••••"
              aria-label="Code PIN à 6 chiffres"
              autoFocus
            />
            {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
            <button type="button" className="btn-primary mt-5 w-full" onClick={verifyPin} disabled={loading || pin.length !== 6}>
              {loading ? 'Vérification…' : 'Continuer'}
            </button>
          </div>
        )}

        {step === 'profile' && (
          <div className="mt-5 space-y-4">
            <div>
              <label className="label" htmlFor="firstName">
                Prénom *
              </label>
              <input
                id="firstName"
                className="input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={60}
                autoFocus
              />
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-brand-50 p-4">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 accent-brand-600"
                checked={shareLocation}
                onChange={(e) => setShareLocation(e.target.checked)}
              />
              <span className="text-sm text-slate-600">
                Partager ma ville — elle apparaîtra sur le rapport.
              </span>
            </label>
            {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => enter()}
              disabled={loading || firstName.trim().length < 3}
            >
              {loading ? 'Connexion…' : 'Commencer'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
