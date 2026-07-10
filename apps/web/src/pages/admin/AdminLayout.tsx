import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api, tokens } from '../../api/client';
import Logo from '../../components/Logo';

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
    return <div className="flex min-h-dvh items-center justify-center text-slate-500">Chargement…</div>;
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
      isActive ? 'bg-brand-600 text-white' : 'text-brand-800 hover:bg-brand-100'
    }`;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-6xl px-4 py-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Logo size={34} />
        <nav className="flex items-center gap-2" aria-label="Navigation admin">
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
          <button type="button" className="btn-ghost text-slate-400" onClick={logout}>
            Déconnexion
          </button>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
