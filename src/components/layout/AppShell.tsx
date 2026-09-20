import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Topbar } from './Topbar';
import { Sidebar, BottomNav } from './Nav';
import { useAuth } from '../../hooks/useAuth';

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
      <Topbar darkMode={darkMode} onToggleDark={() => setDarkMode((d) => !d)} />
      <div className="app-body">
        <Sidebar />
        <main className="main-content">
          <div key={location.pathname} className="page-transition">
            <Outlet />
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
