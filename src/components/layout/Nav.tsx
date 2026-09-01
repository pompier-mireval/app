import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { NiveauAcces } from '../../lib/types';

interface NavItem {
  to: string;
  label: string;
  minNiveau: NiveauAcces;
}

const RANK: Record<NiveauAcces, number> = { utilisateur: 0, admin: 1, superadmin: 2 };

const NAV_ITEMS: NavItem[] = [
  { to: '/dispos', label: 'Mes dispos', minNiveau: 'utilisateur' },
  { to: '/planning', label: 'Planning', minNiveau: 'admin' },
  { to: '/statistiques', label: 'Statistiques', minNiveau: 'admin' },
  { to: '/agents', label: 'Agents', minNiveau: 'admin' },
  { to: '/gardes', label: 'Gardes', minNiveau: 'superadmin' },
  { to: '/vehicules', label: 'Véhicules', minNiveau: 'superadmin' },
  { to: '/referentiels', label: 'Référentiels', minNiveau: 'superadmin' },
  { to: '/habillement', label: 'Habillement', minNiveau: 'utilisateur' },
  { to: '/mecanique', label: 'Mécanique', minNiveau: 'utilisateur' },
  { to: '/inventaire', label: 'Inventaire', minNiveau: 'utilisateur' },
  { to: '/revision', label: 'Révision', minNiveau: 'utilisateur' },
];

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
          <span className="nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function BottomNav() {
  const items = useVisibleItems();
  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <span className="bnav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
