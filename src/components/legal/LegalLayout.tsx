import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

// Mise en page autonome pour les pages légales : ne dépend pas d'une
// session (contrairement à AppShell), car ces pages doivent rester
// accessibles même déconnecté.
export function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="legal-page">
      <div className="legal-page-inner">
        <Link to="/" className="legal-back">
          ← Retour à l'application
        </Link>
        <h1 className="legal-title">{title}</h1>
        {children}
      </div>
    </div>
  );
}
