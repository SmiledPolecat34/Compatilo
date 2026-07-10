import type { QuestionComponentProps } from './registry';
import type { TrileanValue } from '../../types';

const OPTIONS: { value: TrileanValue; label: string; selected: string }[] = [
  { value: 'YES', label: 'Oui', selected: 'border-emerald-400 bg-emerald-50 text-emerald-700' },
  { value: 'POSSIBLE', label: 'Possible', selected: 'border-amber-400 bg-amber-50 text-amber-700' },
  { value: 'NO', label: 'Non', selected: 'border-rose-400 bg-rose-50 text-rose-700' },
];

export default function TrileanQuestion({ question, value, onChange }: QuestionComponentProps) {
  return (
    <div role="radiogroup" aria-label={question.prompt} className="grid grid-cols-3 gap-2">
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`rounded-lg border-2 px-2 py-3 text-sm font-semibold transition active:scale-[0.97] sm:px-3 sm:text-base ${
              active
                ? opt.selected
                : 'border-brand-100 bg-white text-slate-500 hover:border-brand-200'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
