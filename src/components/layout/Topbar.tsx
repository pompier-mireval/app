import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';

interface Props {
  darkMode: boolean;
  onToggleDark: () => void;
}

export function Topbar({ darkMode, onToggleDark }: Props) {
  const { agent, signOut } = useAuth();
  const fullName = agent ? `${agent.prenom} ${agent.nom}`.trim() : '';
  const initials = fullName
    ? fullName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <div className="topbar-logo">
          <img src="/logo.jpg" alt="Logo" />
        </div>
        <span className="topbar-title">Planning caserne</span>
      </div>
      <div className="topbar-actions">
        <button className="icon-btn" onClick={onToggleDark} title={darkMode ? 'Mode clair' : 'Mode sombre'}>
          {darkMode ? '☀' : '☾'}
        </button>
        <div className="user-chip">
          <Link to="/profil" className="avatar-pill" style={{ textDecoration: 'none' }}>
            <span className="avatar-initials">{initials}</span>
            <span className="avatar-name">{fullName || agent?.email}</span>
          </Link>
          <button className="signout-btn" onClick={signOut} title="Se déconnecter">
            ⏻
          </button>
        </div>
      </div>
    </header>
  );
}
