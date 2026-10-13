import type { ReactNode } from 'react';
import type { RevisionSource } from '../../api/revision';

// Rendu minimal du markdown renvoyé par le chatbot (gras, listes, titres),
// sans HTML brut : le texte reste échappé par React.
function inline(text: string, sources: Record<string, RevisionSource>): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[S\d+\])/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const src = /^\[(S\d+)\]$/.exec(part) && sources[part.slice(1, -1)];
    if (src) {
      const label = `${src.nom}, p. ${src.page}`;
      return src.url
        ? <a key={i} href={src.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand, inherit)', textDecoration: 'underline' }}>{label}</a>
        : <span key={i}>{label}</span>;
    }
    return /^\[S\d+\]$/.test(part) ? '' : part;
  });
}

export function ChatText({ text, sources = {} }: { text: string; sources?: Record<string, RevisionSource> }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag key={blocks.length} style={{ margin: '4px 0', paddingLeft: 20 }}>
        {list.items.map((it, i) => <li key={i} style={{ margin: '2px 0' }}>{inline(it, sources)}</li>)}
      </Tag>,
    );
    list = null;
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const ul = /^[-*•]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      const ordered = !!ol;
      if (list && list.ordered !== ordered) flush();
      if (!list) list = { ordered, items: [] };
      list.items.push((ul ?? ol)![1]);
      continue;
    }
    flush();
    if (!line) continue;
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    if (h) blocks.push(<div key={blocks.length} style={{ fontWeight: 700, margin: '8px 0 2px' }}>{inline(h[1], sources)}</div>);
    else if (/^\(?\s*(Sources?\s*:)?\s*\[S\d+\]/.test(line)) blocks.push(<div key={blocks.length} style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>{inline(line, sources)}</div>);
    else blocks.push(<p key={blocks.length} style={{ margin: '4px 0' }}>{inline(line, sources)}</p>);
  }
  flush();
  return <>{blocks}</>;
}
