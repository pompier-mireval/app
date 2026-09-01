import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { NiveauAcces } from '../../lib/types';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  minNiveau: NiveauAcces;
}

const RANK: Record<NiveauAcces, number> = { utilisateur: 0, admin: 1, superadmin: 2 };

const NAV_ITEMS: NavItem[] = [
  { to: '/dispos', label: 'Mes dispos', icon: '🕒', minNiveau: 'utilisateur' },
  { to: '/planning', label: 'Planning', icon: '📅', minNiveau: 'utilisateur' },
  { to: '/statistiques', label: 'Statistiques', icon: '📊', minNiveau: 'admin' },
  { to: '/agents', label: 'Agents', icon: '👥', minNiveau: 'admin' },
  { to: '/gardes', label: 'Gardes', icon: '🚒', minNiveau: 'superadmin' },
  { to: '/vehicules', label: 'Véhicules', icon: '🚐', minNiveau: 'superadmin' },
  { to: '/referentiels', label: 'Référentiels', icon: '⚙️', minNiveau: 'superadmin' },
  { to: '/habillement', label: 'Habillement', icon: '👕', minNiveau: 'utilisateur' },
  { to: '/mecanique', label: 'Mécanique', icon: '🔧', minNiveau: 'utilisateur' },
  { to: '/inventaire', label: 'Inventaire', icon: '📦', minNiveau: 'utilisateur' },
  { to: '/revision', label: 'Révision', icon: '📝', minNiveau: 'utilisateur' },
];

// Le bas d'écran mobile n'a de la place que pour quelques onglets — le
// reste part dans le tiroir "Plus" pour rester lisible et tactile.
const PRIMARY_COUNT = 3;

function useVisibleItems() {
  const { agent } = useAuth();
  const niveau = agent?.niveau_acces ?? 'utilisateur';
  return NAV_ITEMS.filter((item) => RANK[niveau] >= RANK[item.minNiveau]);
}

export function Sidebar() {
  const items = useVisibleItems();
  return (
    <nav className="sidebar">
      <div className="sidebar-section-label">Navigation</div>
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon" aria-hidden="true">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function BottomNav() {
  const items = useVisibleItems();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const primary = items.length > PRIMARY_COUNT + 1 ? items.slice(0, PRIMARY_COUNT) : items;
  const overflow = items.length > PRIMARY_COUNT + 1 ? items.slice(PRIMARY_COUNT) : [];
  const overflowActive = overflow.some((item) => location.pathname.startsWith(item.to));

  return (
    <>
      <nav className="bottom-nav">
        {primary.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
            <span className="bnav-icon" aria-hidden="true">{item.icon}</span>
            <span className="bnav-label">{item.label}</span>
          </NavLink>
        ))}
        {overflow.length > 0 && (
          <button
            type="button"
            className={`bottom-nav-item bottom-nav-more ${overflowActive ? 'active' : ''}`}
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
          >
            <span className="bnav-icon" aria-hidden="true">☰</span>
            <span className="bnav-label">Plus</span>
          </button>
        )}
      </nav>

      {overflow.length > 0 && (
        <div className={`more-sheet-backdrop ${moreOpen ? 'open' : ''}`} onClick={() => setMoreOpen(false)}>
          <div className="more-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="more-sheet-handle" />
            <div className="more-sheet-title">Menu</div>
            <div className="more-sheet-grid">
              {overflow.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `more-sheet-item ${isActive ? 'active' : ''}`}
                >
                  <span className="more-sheet-icon" aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
