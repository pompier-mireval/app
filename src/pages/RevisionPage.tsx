import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  fetchRevisionDocuments,
  addRevisionDocument,
  deleteRevisionDocument,
  askRevision,
  type RevisionDocument,
  type ChatMessage,
} from '../api/revision';
import { extractPdfPages } from '../lib/pdfText';
import { Button, Card, EmptyState, ErrorBanner, PageHeader, Spinner } from '../components/ui/Primitives';
import { useToast } from '../components/ui/Toast';
import { confirmAction } from '../lib/confirm';
import { Quizz } from '../components/revision/Quizz';
import { ChatText } from '../components/ui/ChatText';

export function RevisionPage() {
  const { agent } = useAuth();
  const { showToast } = useToast();
  const isSuperadmin = agent?.niveau_acces === 'superadmin';
  const [mode, setMode] = useState<'chat' | 'quizz'>('chat');
  const [docs, setDocs] = useState<RevisionDocument[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // La liste des documents est réservée au superadmin (voir schema_v7.sql).
    if (!isSuperadmin) {
      setLoading(false);
      return;
    }
    fetchRevisionDocuments()
      .then(setDocs)
      .catch(() => setError('Impossible de charger les documents.'))
      .finally(() => setLoading(false));
  }, [isSuperadmin]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, asking]);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || asking) return;
    setError(null);
    const history = messages;
    setMessages([...history, { role: 'user', text: q }]);
    setQuestion('');
    setAsking(true);
    try {
      const { answer, sources } = await askRevision(q, history);
      setMessages((prev) => [...prev, { role: 'bot', text: answer, sources }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Le chatbot est indisponible.');
    } finally {
      setAsking(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of files) {
        const pages = await extractPdfPages(file);
        if (pages.every((p) => p.length === 0)) {
          setError(`« ${file.name} » ne contient aucun texte (PDF scanné ?) — il ne peut pas être utilisé.`);
          continue;
        }
        await addRevisionDocument(file.name.replace(/\.pdf$/i, ''), pages, file);
        showToast(`« ${file.name} » ajouté (${pages.length} pages).`);
      }
      setDocs(await fetchRevisionDocuments());
    } catch (err) {
      console.error(err);
      setError("Impossible d'ajouter ce document.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: RevisionDocument) {
    if (!confirmAction(`Supprimer « ${doc.nom} » ?`)) return;
    try {
      await deleteRevisionDocument(doc.id);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      console.error(err);
      setError('Impossible de supprimer ce document.');
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="stack">
      <PageHeader title="Révision" sub="Pose une question ou entraîne-toi avec un quizz : tout vient uniquement des documents de révision." />
      {error && <ErrorBanner message={error} />}

      <div className="field-row">
        <Button type="button" variant={mode === 'chat' ? 'primary' : 'secondary'} onClick={() => setMode('chat')}>Questions</Button>
        <Button type="button" variant={mode === 'quizz' ? 'primary' : 'secondary'} onClick={() => setMode('quizz')}>Quizz</Button>
      </div>

      {mode === 'quizz' && <Quizz />}

      {mode === 'chat' && <Card accent="brand">
        <div className="stack-sm">
          {messages.length === 0 && <EmptyState>Pose ta première question.</EmptyState>}
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '8px 12px',
                borderRadius: 10,
                whiteSpace: m.role === 'user' ? 'pre-wrap' : undefined,
                fontSize: 14,
                background: m.role === 'user' ? 'var(--brand-soft, var(--surface2))' : 'var(--surface2)',
                border: '1px solid var(--border)',
              }}
            >
              {m.role === 'user' ? m.text : <ChatText text={m.text} sources={m.sources} />}
            </div>
          ))}
          {asking && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Recherche dans les documents…</div>}
          <div ref={endRef} />
        </div>
        <form className="field-row" style={{ marginTop: 12 }} onSubmit={handleAsk}>
          <input
            className="input"
            style={{ flex: 1 }}
            maxLength={1000}
            placeholder="Ta question…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <Button type="submit" disabled={asking || !question.trim()}>Envoyer</Button>
        </form>
      </Card>}

      {isSuperadmin && (
      <Card>
        <strong>Documents ({docs.length})</strong>
        <div className="stack-sm" style={{ marginTop: 10 }}>
          {docs.map((d) => (
            <div key={d.id} className="list-row">
              <span>{d.nom} <span style={{ color: 'var(--text-3)', fontSize: 12 }}>· {d.nb_pages} pages</span></span>
              <button className="link-delete" onClick={() => handleDelete(d)}>supprimer</button>
            </div>
          ))}
          {(
            <div>
              <label className="btn-secondary" style={{ cursor: uploading ? 'wait' : 'pointer', display: 'inline-block' }}>
                {uploading ? 'Import en cours…' : 'Ajouter des PDF'}
                <input type="file" accept="application/pdf" multiple hidden disabled={uploading} onChange={handleUpload} />
              </label>
            </div>
          )}
        </div>
      </Card>
      )}
    </div>
  );
}
