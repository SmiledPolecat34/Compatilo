import { useTheme, type Theme } from './ThemeProvider';

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'Clair', icon: '☀️' },
  { value: 'dark', label: 'Sombre', icon: '🌙' },
  { value: 'custom', label: 'Coucher de soleil', icon: '🌅' },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div role="radiogroup" aria-label="Thème de l'application" className="flex shrink-0 items-center gap-1 rounded-lg bg-brand-100/60 p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={theme === opt.value}
          aria-label={opt.label}
          title={opt.label}
          onClick={() => setTheme(opt.value)}
          className={`rounded-md px-2 py-1.5 text-sm transition ${
            theme === opt.value ? 'bg-surface shadow-sm' : 'opacity-60 hover:opacity-100'
          }`}
        >
          <span aria-hidden>{opt.icon}</span>
        </button>
      ))}
    </div>
  );
}
