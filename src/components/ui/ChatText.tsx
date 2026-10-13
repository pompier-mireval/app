import type { ReactNode } from 'react';

// Rendu minimal du markdown renvoyé par le chatbot (gras, listes, titres),
// sans HTML brut : le texte reste échappé par React.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

export function ChatText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag key={blocks.length} style={{ margin: '4px 0', paddingLeft: 20 }}>
        {list.items.map((it, i) => <li key={i} style={{ margin: '2px 0' }}>{inline(it)}</li>)}
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
    if (h) blocks.push(<div key={blocks.length} style={{ fontWeight: 700, margin: '8px 0 2px' }}>{inline(h[1])}</div>);
    else if (/^\(.*\)$/.test(line) && /\bp\.\s*\d/.test(line)) blocks.push(<div key={blocks.length} style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>{line}</div>);
    else blocks.push(<p key={blocks.length} style={{ margin: '4px 0' }}>{inline(line)}</p>);
  }
  flush();
  return <>{blocks}</>;
}
