import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LegalLinks } from '../legal/LegalLinks';
import { PasswordInput } from '../ui/Primitives';

export function AuthScreen() {
  const { signInWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cguAccepted, setCguAccepted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Renseigne ton adresse email professionnelle.');
      return;
    }
    if (!password) {
      setError('Renseigne ton mot de passe.');
      return;
    }
    if (!cguAccepted) {
      setError("Coche la case pour accepter les CGU et la politique de confidentialité avant de continuer.");
      return;
    }

    setSubmitting(true);
    try {
      await signInWithPassword(email.trim(), password);
      // La redirection vers l'app se fait automatiquement via le
      // changement de session détecté par useAuth.
    } catch {
      setError('Email ou mot de passe incorrect.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-bg-grid" />
      <div className="auth-card">
        <div className="auth-emblem">
          <img src={`${import.meta.env.BASE_URL}logo-256.webp`} alt="Logo caserne" decoding="async" />
        </div>
        <h1 className="auth-title">Planning caserne</h1>
        <p className="auth-sub">Connecte-toi pour accéder au planning.</p>
        <div className="auth-divider" />

        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            className="input"
            placeholder="p.nom@sdis34.fr"
            aria-label="Adresse email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
          <PasswordInput
            placeholder="Mot de passe"
            ariaLabel="Mot de passe"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
          <label className="checkbox-pill" style={{ fontSize: 12 }}>
            <input
              type="checkbox"
              checked={cguAccepted}
              onChange={(e) => setCguAccepted(e.target.checked)}
            />
            {/* Un seul bloc de texte : sans ce <span>, chaque morceau devenait une colonne du flex. */}
            <span>
              J'ai lu et j'accepte les{' '}
              <a href="#/cgu" target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>CGU</a>{' '}
              et la{' '}
              <a href="#/confidentialite" target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                politique de confidentialité
              </a>
            </span>
          </label>
          {error && <p role="alert" style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}
          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
        <LegalLinks className="auth-legal-links" />
      </div>
    </div>
  );
}
