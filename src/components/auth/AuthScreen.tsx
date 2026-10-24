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
            placeholder="prenom.nom@sdis34.fr"
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
          {error && <p role="alert" style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}
          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Connexion…' : 'Se connecter'}
          </button>
          <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
            En te connectant, tu acceptes les{' '}
            <a href="#/cgu" target="_blank" rel="noreferrer">CGU</a> et la{' '}
            <a href="#/confidentialite" target="_blank" rel="noreferrer">politique de confidentialité</a>.
          </p>
        </form>
        <LegalLinks className="auth-legal-links" />
      </div>
    </div>
  );
}
