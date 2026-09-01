import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Topbar } from './Topbar';
import { Sidebar, BottomNav } from './Nav';

export function AppShell() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === '1');
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', darkMode ? '1' : '0');
  }, [darkMode]);

  return (
    <div className="app">
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
