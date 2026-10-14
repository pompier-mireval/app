import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Topbar } from './Topbar';
import { Sidebar, BottomNav } from './Nav';
import { useAuth } from '../../hooks/useAuth';
import { Spinner } from '../ui/Primitives';

const NIVEAU_LABEL: Record<string, string> = {
  utilisateur: 'Utilisateur',
  admin: 'Admin',
  superadmin: 'Superadmin',
};

export function AppShell() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === '1');
  const location = useLocation();
  const { rolePreview, setRolePreview } = useAuth();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode ? '1' : '0');
  }, [darkMode]);

  return (
    <div className="app">
      {rolePreview && (
        <div className="role-preview-banner">
          Aperçu — tu vois l'appli comme un compte <strong>{NIVEAU_LABEL[rolePreview]}</strong>, tes vraies
          données ne sont pas affectées.
          <button className="link-edit" onClick={() => setRolePreview(null)}>Quitter l'aperçu</button>
        </div>
      )}
      <button type="button" className="skip-link" onClick={() => document.getElementById('contenu')?.focus()}>
        Aller au contenu
      </button>
      <Topbar darkMode={darkMode} onToggleDark={() => setDarkMode((d) => !d)} />
      <div className="app-body">
        <Sidebar />
        <main className="main-content" id="contenu" tabIndex={-1}>
          <div key={location.pathname} className="page-transition">
            <Suspense fallback={<Spinner />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
