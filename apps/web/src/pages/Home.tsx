import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Logo from '../components/Logo';
import PinModal from '../components/PinModal';
import AdminLoginModal from '../components/AdminLoginModal';

export default function Home() {
  const { pin: pinFromPath } = useParams();
  const [searchParams] = useSearchParams();
  const prefilledPin = pinFromPath ?? searchParams.get('pin') ?? '';
  const [modalOpen, setModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  // Un lien d'invitation ouvre automatiquement la popup, PIN pré-rempli
  useEffect(() => {
    if (/^\d{6}$/.test(prefilledPin)) setModalOpen(true);
  }, [prefilledPin]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <main className="flex w-full max-w-md flex-col items-center text-center animate-fade-up">
        <Logo size={56} />
        <h1 className="mt-8 font-display text-4xl font-bold leading-tight text-brand-900 sm:text-5xl">
          Découvrez votre
          <span className="bg-gradient-to-r from-brand-600 to-rose-accent bg-clip-text text-transparent">
            {' '}
            compatibilité
          </span>
        </h1>
        <p className="mt-4 text-lg text-slate-500">
          Répondez chacun de votre côté, comparez vos réponses et recevez votre rapport
          personnalisé.
        </p>

        <button type="button" className="btn-primary mt-10 w-full text-lg" onClick={() => setModalOpen(true)}>
          Entrer un code PIN
        </button>

        <div className="mt-14 grid w-full grid-cols-3 gap-3 text-sm text-slate-500">
          {[
            ['🔒', 'Privé'],
            ['💜', '2 personnes'],
            ['📄', 'Rapport PDF'],
          ].map(([icon, label]) => (
            <div key={label} className="card px-3 py-4">
              <div className="text-xl">{icon}</div>
              <div className="mt-1 font-medium">{label}</div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="btn-ghost mt-10 text-sm text-slate-400"
          onClick={() => setAdminModalOpen(true)}
        >
          Administration
        </button>
      </main>

      <PinModal open={modalOpen} initialPin={prefilledPin} onClose={() => setModalOpen(false)} />
      <AdminLoginModal open={adminModalOpen} onClose={() => setAdminModalOpen(false)} />
    </div>
  );
}
