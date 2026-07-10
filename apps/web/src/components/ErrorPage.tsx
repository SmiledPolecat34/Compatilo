import { Link } from 'react-router-dom';
import Logo from './Logo';

export type ErrorVariant = '404' | '403' | '500';

const CONTENT: Record<ErrorVariant, { icon: string; title: string; message: string }> = {
  '404': {
    icon: '🧭',
    title: 'Page introuvable',
    message: "Ce lien ne mène nulle part. Vérifie l'adresse ou reviens à l'accueil.",
  },
  '403': {
    icon: '🔒',
    title: 'Accès refusé',
    message: "Tu n'as pas les autorisations nécessaires pour voir cette page.",
  },
  '500': {
    icon: '⚠️',
    title: 'Une erreur est survenue',
    message: "Quelque chose s'est mal passé de notre côté. Réessaie dans un instant.",
  },
};

export default function ErrorPage({
  variant,
  detail,
  onRetry,
}: {
  variant: ErrorVariant;
  detail?: string;
  onRetry?: () => void;
}) {
  const content = CONTENT[variant];

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10 text-center">
      <div className="card w-full max-w-md p-8 animate-fade-up">
        <Logo size={44} />
        <div className="mt-6 text-5xl" aria-hidden>
          {content.icon}
        </div>
        <p className="mt-3 text-sm font-bold uppercase tracking-[0.2em] text-brand-400">
          Erreur {variant}
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold text-brand-900">{content.title}</h1>
        <p className="mt-3 text-slate-500">{content.message}</p>
        {detail && (
          <p className="mt-3 rounded-xl bg-brand-50 p-3 text-left text-xs text-slate-500">{detail}</p>
        )}
        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {onRetry && (
            <button type="button" className="btn-secondary" onClick={onRetry}>
              Réessayer
            </button>
          )}
          <Link to="/" className="btn-primary">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
