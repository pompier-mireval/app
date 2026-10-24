import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './hooks/useAuth';
import { ToastProvider } from './components/ui/Toast';
import { reloadOnce } from './components/ui/ErrorBoundary';
import './styles/index.css';

// Vite émet cet événement quand un fichier d'une page chargée à la demande
// est introuvable (nouveau déploiement) : on recharge pour récupérer la
// nouvelle version plutôt que de laisser un écran vide.
window.addEventListener('vite:preloadError', (e) => {
  if (reloadOnce()) e.preventDefault();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>
);
