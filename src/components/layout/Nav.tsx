import { useEffect, useState } from 'react';
import type React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { NiveauAcces } from '../../lib/types';
import {
  IconClock,
  IconCalendar,
  IconBarChart,
  IconUsers,
  IconShield,
  IconTruck,
  IconSettings,
  IconShirt,
  IconWrench,
  IconBox,
  IconClipboardCheck,
  IconMenu,
} from '../ui/Icons';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  minNiveau: NiveauAcces;
}

const RANK: Record<NiveauAcces, number> = { utilisateur: 0, admin: 1, superadmin: 2 };

const NAV_ITEMS: NavItem[] = [
  { to: '/dispos', label: 'Mes dispos', icon: IconClock, minNiveau: 'utilisateur' },
  { to: '/planning', label: 'Planning', icon: IconCalendar, minNiveau: 'utilisateur' },
  { to: '/statistiques', label: 'Statistiques', icon: IconBarChart, minNiveau: 'admin' },
  { to: '/agents', label: 'Agents', icon: IconUsers, minNiveau: 'admin' },
  { to: '/gardes', label: 'Gardes', icon: IconShield, minNiveau: 'superadmin' },
  { to: '/vehicules', label: 'Véhicules', icon: IconTruck, minNiveau: 'superadmin' },
  { to: '/referentiels', label: 'Référentiels', icon: IconSettings, minNiveau: 'superadmin' },
  { to: '/habillement', label: 'Habillement', icon: IconShirt, minNiveau: 'utilisateur' },
  { to: '/mecanique', label: 'Mécanique', icon: IconWrench, minNiveau: 'utilisateur' },
  { to: '/inventaire', label: 'Inventaire', icon: IconBox, minNiveau: 'utilisateur' },
  { to: '/revision', label: 'Révision', icon: IconClipboardCheck, minNiveau: 'utilisateur' },
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
          <item.icon className="nav-icon" aria-hidden="true" />
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
            <item.icon className="bnav-icon" aria-hidden="true" />
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
            <IconMenu className="bnav-icon" aria-hidden="true" />
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
                  <item.icon className="more-sheet-icon" aria-hidden="true" />
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
