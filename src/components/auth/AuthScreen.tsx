import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export function AuthScreen() {
  const { sendMagicLink, signInWithPassword } = useAuth();
  const [mode, setMode] = useState<'lien' | 'mdp'>('lien');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Renseigne ton adresse email professionnelle.');
      return;
    }
    if (mode === 'mdp' && !password) {
      setError('Renseigne ton mot de passe.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'lien') {
        await sendMagicLink(email.trim());
        setSent(true);
      } else {
        await signInWithPassword(email.trim(), password);
        // La redirection vers l'app se fait automatiquement via le
        // changement de session détecté par useAuth.
      }
    } catch {
      setError(
        mode === 'lien'
          ? "Impossible d'envoyer le lien. Vérifie ton adresse et réessaie."
          : 'Email ou mot de passe incorrect.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-bg-grid" />
      <div className="auth-card">
        <div className="auth-emblem">
          <img src="/logo.jpg" alt="Logo caserne" />
        </div>
        <h1 className="auth-title">Planning caserne</h1>
        <p className="auth-sub">Connecte-toi pour accéder au planning.</p>
        <div className="auth-divider" />

        {sent ? (
          <p className="auth-sub">
            Un lien de connexion vient de t'être envoyé par email. Clique dessus pour accéder à l'application.
          </p>
        ) : (
          <>
            <div className="auth-mode-switch">
              <button
                type="button"
                className={mode === 'lien' ? 'auth-mode-btn active' : 'auth-mode-btn'}
                onClick={() => setMode('lien')}
              >
                Lien par email
              </button>
              <button
                type="button"
                className={mode === 'mdp' ? 'auth-mode-btn active' : 'auth-mode-btn'}
                onClick={() => setMode('mdp')}
              >
                Email + mot de passe
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="email"
                className="input"
                placeholder="prenom.nom@ta-caserne.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              {mode === 'mdp' && (
                <input
                  type="password"
                  className="input"
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              )}
              {error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}
              <button className="btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Connexion…' : mode === 'lien' ? 'Recevoir le lien de connexion' : 'Se connecter'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
