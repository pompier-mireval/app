import { Card, PageHeader } from '../components/ui/Primitives';

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="stack">
      <PageHeader title={title} />
      <Card>
        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
          Cette page est en construction — elle rejoindra bientôt le reste de l'application.
        </p>
      </Card>
    </div>
  );
}
