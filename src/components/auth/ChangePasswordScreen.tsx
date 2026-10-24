import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { PasswordInput } from '../ui/Primitives';

// Affiché à la première connexion d'un compte créé avec un mot de passe
// provisoire : l'app reste inaccessible tant qu'il n'est pas remplacé.
export function ChangePasswordScreen() {
  const { updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(password);
      // La session mise à jour lève le drapeau : l'app s'affiche d'elle-même.
    } catch {
      setError('Impossible de changer le mot de passe (identique au mot de passe provisoire ?).');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-bg-grid" />
      <div className="auth-card">
        <h1 className="auth-title">Nouveau mot de passe</h1>
        <p className="auth-sub">Pour ta première connexion, choisis un mot de passe personnel.</p>
        <div className="auth-divider" />
        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PasswordInput ariaLabel="Nouveau mot de passe" placeholder="Nouveau mot de passe" autoComplete="new-password" value={password} onChange={setPassword} />
          <PasswordInput ariaLabel="Confirmer le mot de passe" placeholder="Confirmer le mot de passe" autoComplete="new-password" value={confirm} onChange={setConfirm} />
          {error && <p role="alert" style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}
          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button type="button" className="auth-mode-btn" onClick={signOut}>Se déconnecter</button>
        </form>
      </div>
    </div>
  );
}
