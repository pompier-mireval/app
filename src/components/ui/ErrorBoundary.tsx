import { Component } from 'react';
import type { ReactNode } from 'react';

const RELOAD_KEY = 'chunkReloadAt';

// Après un nouveau déploiement, les fichiers d'une page chargée à la demande
// (lazy) changent de nom : l'onglet resté ouvert demande l'ancien et échoue.
export function isChunkError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(msg);
}

// Recharge la page une seule fois (garde-fou anti-boucle : pas deux fois en 30 s).
export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

interface State {
  error: unknown;
}

// Sans ça, une erreur de rendu dans une page démonte toute l'application :
// écran noir jusqu'au rechargement manuel.
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
    if (isChunkError(error)) reloadOnce();
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Changer de page efface l'erreur : le reste de l'appli reste utilisable.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card" role="alert" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
        <strong>Cette page n'a pas pu s'afficher.</strong>
        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
          {isChunkError(this.state.error)
            ? "Une nouvelle version de l'application est disponible."
            : "Une erreur est survenue."}
        </span>
        <button className="btn-primary" onClick={() => window.location.reload()}>Recharger</button>
      </div>
    );
  }
}
