import type { ChangeEvent, ComponentType } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { AnswerValue, QuestionDto, TrileanValue } from '../../types';
import TrileanQuestion from './TrileanQuestion';
import { useToast } from '../ToastProvider';

export interface QuestionComponentProps {
  question: QuestionDto;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}

const YES_NO: { value: TrileanValue; label: string }[] = [
  { value: 'YES', label: 'Oui' },
  { value: 'NO', label: 'Non' },
];

const ORIGINS = [
  { value: 'FR', label: 'Française', flag: '🇫🇷' },
  { value: 'DZ', label: 'Algérienne', flag: '🇩🇿' },
  { value: 'MA', label: 'Marocaine', flag: '🇲🇦' },
  { value: 'TN', label: 'Tunisienne', flag: '🇹🇳' },
  { value: 'SN', label: 'Sénégalaise', flag: '🇸🇳' },
  { value: 'CI', label: 'Ivoirienne', flag: '🇨🇮' },
  { value: 'CM', label: 'Camerounaise', flag: '🇨🇲' },
  { value: 'HT', label: 'Haïtienne', flag: '🇭🇹' },
  { value: 'PT', label: 'Portugaise', flag: '🇵🇹' },
  { value: 'ES', label: 'Espagnole', flag: '🇪🇸' },
  { value: 'IT', label: 'Italienne', flag: '🇮🇹' },
  { value: 'TR', label: 'Turque', flag: '🇹🇷' },
];

function getString(value: AnswerValue | undefined) {
  return typeof value === 'string' ? value : '';
}

function TextQuestion({ question, value, onChange }: QuestionComponentProps) {
  const multiline = question.type === 'textarea';
  const common = {
    className: 'input',
    value: getString(value),
    minLength: Number(question.config.minLength ?? 1),
    maxLength: Number(question.config.maxLength ?? 500),
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    placeholder: question.required ? 'Réponse obligatoire' : 'Optionnel',
  };
  return multiline ? <textarea {...common} rows={3} /> : <input {...common} />;
}

function PhoneQuestion(props: QuestionComponentProps) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    let digits = 0;
    let capped = '';
    for (const char of raw) {
      if (/\d/.test(char)) {
        if (digits >= 10) continue;
        digits += 1;
      }
      capped += char;
    }
    props.onChange(capped);
  }
  return (
    <input
      className="input"
      inputMode="tel"
      autoComplete="tel"
      value={getString(props.value)}
      onChange={handleChange}
      placeholder="+33 6 12 34 56 78"
    />
  );
}

function DateQuestion(props: QuestionComponentProps) {
  return <input className="input" type="date" value={getString(props.value)} onChange={(e) => props.onChange(e.target.value)} />;
}

function YesNoQuestion({ question, value, onChange }: QuestionComponentProps) {
  return (
    <div role="radiogroup" aria-label={question.prompt} className="grid grid-cols-2 gap-2">
      {YES_NO.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-lg border-2 px-3 py-3 font-semibold transition active:scale-[0.97] ${
            value === opt.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-brand-100 bg-surface text-slate-500 hover:border-brand-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ChoiceQuestion({ question, value, onChange }: QuestionComponentProps) {
  const options = Array.isArray(question.config.options)
    ? (question.config.options as { value: string; label: string }[])
    : [];
  return (
    <div role="radiogroup" aria-label={question.prompt} className="grid grid-cols-2 gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-lg border-2 px-3 py-3 font-semibold transition active:scale-[0.97] ${
            value === opt.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-brand-100 bg-surface text-slate-500 hover:border-brand-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function CityQuestion({ value, onChange }: QuestionComponentProps) {
  const toast = useToast();
  const current =
    value && typeof value === 'object' && 'city' in value
      ? (value as { city: string; latitude: number | null; longitude: number | null; locationConsent: boolean })
      : { city: '', latitude: null, longitude: null, locationConsent: false };
  const [coords, setCoords] = useState(
    current.latitude !== null && current.longitude !== null ? `${current.latitude}, ${current.longitude}` : '',
  );
  const [locating, setLocating] = useState(false);

  function update(patch: Partial<typeof current>) {
    onChange({ ...current, ...patch });
  }

  useEffect(() => {
    setCoords(
      current.latitude !== null && current.longitude !== null
        ? `${current.latitude}, ${current.longitude}`
        : '',
    );
  }, [current.latitude, current.longitude]);

  async function useGeolocation() {
    if (!('geolocation' in navigator)) {
      toast.error("Ton navigateur ne prend pas en charge la géolocalisation.");
      return;
    }
    setLocating(true);
    try {
      // Déclenche l'invite d'autorisation native du navigateur/appareil.
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 }),
      );
      const latitude = pos.coords.latitude;
      const longitude = pos.coords.longitude;
      setCoords(`${latitude}, ${longitude}`);
      try {
        const geo = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=fr`,
        ).then((r) => r.json());
        const city = geo.city || geo.locality || geo.principalSubdivision || current.city || `Position ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        update({ city, latitude, longitude, locationConsent: true });
      } catch {
        update({ city: current.city || `Position ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, latitude, longitude, locationConsent: true });
      }
    } catch (err) {
      const code = err instanceof GeolocationPositionError ? err.code : null;
      if (code === 1) {
        toast.error('Autorisation refusée — active la localisation pour ce site dans les réglages de ton navigateur.');
      } else if (code === 3) {
        toast.error('La localisation a mis trop de temps à répondre, réessaie.');
      } else {
        toast.error('Impossible de récupérer ta position.');
      }
    } finally {
      setLocating(false);
    }
  }

  function applyCoords(raw: string) {
    setCoords(raw);
    const [lat, lng] = raw.split(',').map((x) => Number(x.trim()));
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      update({ latitude: lat, longitude: lng, locationConsent: true });
    }
  }

  return (
    <div className="space-y-3">
      <input className="input" value={current.city} onChange={(e) => update({ city: e.target.value })} placeholder="Recherche ou saisis ta ville" />
      <button type="button" className="btn-secondary w-full" onClick={useGeolocation} disabled={locating}>
        {locating ? 'Localisation…' : '📍 Utiliser ma position actuelle'}
      </button>
      <input className="input" value={coords} onChange={(e) => applyCoords(e.target.value)} placeholder="Coordonnées carte : latitude, longitude" />
    </div>
  );
}

function OriginsQuestion({ value, onChange }: QuestionComponentProps) {
  const current =
    value && typeof value === 'object' && 'selected' in value
      ? (value as { selected: string[]; custom: string | null })
      : { selected: [], custom: null };
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => ORIGINS.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  function toggle(origin: string) {
    const selected = current.selected.includes(origin)
      ? current.selected.filter((x) => x !== origin)
      : [...current.selected, origin];
    onChange({ ...current, selected });
  }

  return (
    <div className="space-y-3">
      <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une origine" />
      <div className="grid gap-2 sm:grid-cols-2">
        {filtered.map((origin) => (
          <button
            key={origin.value}
            type="button"
            onClick={() => toggle(origin.value)}
            className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold ${
              current.selected.includes(origin.value)
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-brand-100 bg-surface text-slate-600'
            }`}
          >
            <span className="mr-2">{origin.flag}</span>
            {origin.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const registry: Record<string, ComponentType<QuestionComponentProps>> = {
  trilean: TrileanQuestion as ComponentType<QuestionComponentProps>,
  yesno: YesNoQuestion,
  text: TextQuestion,
  textarea: TextQuestion,
  phone: PhoneQuestion,
  date: DateQuestion,
  city: CityQuestion,
  origins: OriginsQuestion,
  choice: ChoiceQuestion,
};

export function getQuestionComponent(type: string): ComponentType<QuestionComponentProps> {
  return registry[type] ?? TextQuestion;
}
