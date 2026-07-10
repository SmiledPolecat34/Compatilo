import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api, tokens } from '../../api/client';
import Logo from '../../components/Logo';
import { PageSpinner } from '../../components/Skeleton';
import ThemeToggle from '../../theme/ThemeToggle';

export default function AdminLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api<{ email: string }>('/api/admin/auth/me', { auth: 'admin' })
      .then(() => setReady(true))
      .catch(() => navigate('/admin/login'));
  }, [navigate]);

  async function logout() {
    await api('/api/admin/auth/logout', { method: 'POST' }).catch(() => undefined);
    tokens.clear('admin');
    navigate('/admin/login');
  }

  if (!ready) {
    return <PageSpinner />;
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition ${
      isActive ? 'bg-brand-600 text-white' : 'text-brand-800 hover:bg-brand-100'
    }`;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-7xl overflow-x-hidden px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-3 sm:mb-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="shrink-0">
          <Logo size={34} />
        </div>
        <nav
          className="-mx-3 flex max-w-[calc(100%+1.5rem)] items-center gap-1 overflow-x-auto px-3 pb-1 sm:mx-0 sm:max-w-full sm:flex-wrap sm:justify-end sm:overflow-visible sm:px-0 sm:pb-0"
          aria-label="Navigation admin"
        >
          <NavLink to="/admin" end className={linkClass}>
            Sessions
          </NavLink>
          <NavLink to="/admin/questionnaires" className={linkClass}>
            Questionnaires
          </NavLink>
          <NavLink to="/admin/music" className={linkClass}>
            Musique
          </NavLink>
          <NavLink to="/admin/stats" className={linkClass}>
            Statistiques
          </NavLink>
          <NavLink to="/admin/security" className={linkClass}>
            Sécurité
          </NavLink>
          <button type="button" className="btn-ghost shrink-0 text-slate-500" onClick={logout}>
            Déconnexion
          </button>
          <ThemeToggle />
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
