import { useTheme, type Theme } from './ThemeProvider';

const ORDER: Theme[] = ['light', 'dark', 'custom'];
const META: Record<Theme, { label: string; icon: string }> = {
  light: { label: 'Clair', icon: '☀️' },
  dark: { label: 'Sombre', icon: '🌙' },
  custom: { label: 'Coucher de soleil', icon: '🌅' },
};

/** Bouton unique flottant, visible partout, qui fait défiler les 3 thèmes. */
export default function ThemeCycleButton() {
  const { theme, setTheme } = useTheme();

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Thème actuel : ${META[theme].label}. Cliquer pour changer.`}
      title={`Thème : ${META[theme].label}`}
      className="fixed right-3 top-3 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-brand-100 bg-surface text-xl shadow-lg transition active:scale-90"
      style={{ marginTop: 'env(safe-area-inset-top)' }}
    >
      <span aria-hidden>{META[theme].icon}</span>
    </button>
  );
}
