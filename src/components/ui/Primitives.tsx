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
