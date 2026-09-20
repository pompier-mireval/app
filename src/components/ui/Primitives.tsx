import { useEffect, useRef } from 'react';
import type React from 'react';

export function Card({
  children,
  className = '',
  accent,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: 'brand' | 'green' | 'amber' | 'red';
}) {
  const accentClass = accent ? `card-accent-${accent}` : '';
  return <div className={`card ${accentClass} ${className}`}>{children}</div>;
}

export function PageHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="page-header">
      <h1 className="page-title">{title}</h1>
      {sub && <p className="page-sub">{sub}</p>}
    </div>
  );
}

export function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <label className="field" style={style}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function Spinner() {
  return <span className="auth-spinner" role="status" aria-label="Chargement" />;
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="error-banner">{message}</div>;
}

export function SuccessBanner({ message }: { message: string }) {
  return <div className="success-banner">{message}</div>;
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'green' | 'amber' | 'red';
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Status({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'green' | 'amber' | 'red' | 'brand';
}) {
  return (
    <span className="status">
      <span className={`status-dot tone-${tone}`} />
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="empty-state">{children}</p>;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Piège de focus : un lecteur d'écran ou un clavier ne doit pas
      // pouvoir tabuler vers la page derrière l'overlay tant que la popup
      // est ouverte (pattern ARIA "dialog").
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);

    // Focus initial dans la popup, puis restauration au déclencheur à la
    // fermeture — sans ça, le focus clavier reste "perdu" sur un élément
    // caché derrière l'overlay.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (first ?? panelRef.current)?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panelRef}>
        <div className="modal-header">
          <strong style={{ fontSize: 14 }}>{title}</strong>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  return (
    <button className={variant === 'primary' ? 'btn-primary' : 'btn-secondary'} {...rest}>
      {children}
    </button>
  );
}
