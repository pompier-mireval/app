import { Link } from 'react-router-dom';

export function LegalLinks({ className }: { className?: string }) {
  return (
    <div className={`legal-links ${className ?? ''}`}>
      <Link to="/mentions-legales">Mentions légales</Link>
      <Link to="/confidentialite">Confidentialité</Link>
      <Link to="/cgu">CGU</Link>
    </div>
  );
}
