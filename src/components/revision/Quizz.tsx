import { useState } from 'react';
import { askQuizz, type QuizzQuestion } from '../../api/revision';
import { Button, Card, ErrorBanner } from '../ui/Primitives';

export function Quizz() {
  const [theme, setTheme] = useState('');
  const [q, setQ] = useState<QuizzQuestion | null>(null);
  const [choix, setChoix] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState({ bonnes: 0, total: 0 });

  async function suivante() {
    setLoading(true);
    setError(null);
    setChoix(null);
    try {
      setQ(await askQuizz(theme.trim()));
    } catch (err) {
      setQ(null);
      setError(err instanceof Error ? err.message : 'Le quizz est indisponible.');
    } finally {
      setLoading(false);
    }
  }

  function repondre(i: number) {
    if (!q || choix !== null) return;
    setChoix(i);
    setScore((s) => ({ bonnes: s.bonnes + (i === q.bonne ? 1 : 0), total: s.total + 1 }));
  }

  return (
    <Card accent="brand">
      <div className="stack-sm">
        <div className="field-row">
          <input
            className="input"
            style={{ flex: 1 }}
            maxLength={100}
            placeholder="Thème (facultatif) : ex. désincarcération, LSPCC…"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          />
          <Button type="button" onClick={suivante} disabled={loading}>{q ? 'Question suivante' : 'Commencer'}</Button>
        </div>
        {score.total > 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Score : {score.bonnes} / {score.total}</div>
        )}
        {error && <ErrorBanner message={error} />}
        {loading && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Préparation de la question…</div>}
        {q && !loading && (
          <>
            <strong style={{ fontSize: 15 }}>{q.question}</strong>
            {q.choix.map((c, i) => {
              const fini = choix !== null;
              const bon = fini && i === q.bonne;
              const faux = fini && i === choix && i !== q.bonne;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => repondre(i)}
                  disabled={fini}
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    borderRadius: 10,
                    fontSize: 14,
                    cursor: fini ? 'default' : 'pointer',
                    color: 'inherit',
                    background: bon ? 'rgba(34,197,94,.18)' : faux ? 'rgba(239,68,68,.18)' : 'var(--surface2)',
                    border: `1px solid ${bon ? '#22c55e' : faux ? '#ef4444' : 'var(--border)'}`,
                  }}
                >
                  {String.fromCharCode(65 + i)}. {c}
                </button>
              );
            })}
            {choix !== null && (
              <div style={{ fontSize: 14 }}>
                <strong>{choix === q.bonne ? '✅ Bonne réponse !' : '❌ Raté.'}</strong> {q.explication}
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                  Source :{' '}
                  {q.source.url
                    ? <a href={q.source.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', color: 'inherit' }}>{q.source.nom}, p. {q.source.page}</a>
                    : `${q.source.nom}, p. ${q.source.page}`}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
