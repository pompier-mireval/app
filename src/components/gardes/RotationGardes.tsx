import { useEffect, useMemo, useState } from 'react';
import { setGardeSemaine } from '../../api/gardeSemaines';
import { todayIso, addDays, mondayOf, fridayOf, dayLabel } from '../../lib/dates';
import type { Garde } from '../../lib/types';
import { Card, Field, Button } from '../ui/Primitives';
import { useToast } from '../ui/Toast';

type Cible = 'semaine' | 'weekend';

// Génère en une fois la garde de service de plusieurs semaines à venir,
// au lieu de choisir une garde à la main semaine par semaine dans le
// Planning. Couvre les deux rotations réelles de la caserne : la nuit
// Lundi-Jeudi (ancrée sur le lundi) et le week-end Vendredi nuit-Dimanche
// nuit (ancré sur le vendredi) — chacune tourne sur son propre cycle de
// gardes, généralement 4 gardes → une rotation complète toutes les 4
// semaines (28 jours).
export function RotationGardes({ gardes, onError }: { gardes: Garde[]; onError: (msg: string | null) => void }) {
  const { showToast } = useToast();
  const [cible, setCible] = useState<Cible>('semaine');
  const [dateDepart, setDateDepart] = useState(todayIso());
  const [ordre, setOrdre] = useState<string[]>([]);
  const [occurrences, setOccurrences] = useState(12);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // L'ordre du cycle suit par défaut la liste des gardes existantes ; si
  // une garde est ajoutée/supprimée depuis la page, on met à jour sans
  // perdre le réordonnancement déjà fait sur les gardes qui restent.
  useEffect(() => {
    setOrdre((prev) => {
      const stillValid = prev.filter((id) => gardes.some((g) => g.id === id));
      const missing = gardes.map((g) => g.id).filter((id) => !stillValid.includes(id));
      return [...stillValid, ...missing];
    });
  }, [gardes]);

  function move(index: number, direction: -1 | 1) {
    setOrdre((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const ancre = cible === 'semaine' ? mondayOf(dateDepart) : fridayOf(dateDepart);
  const gardeNom = (id: string) => gardes.find((g) => g.id === id)?.nom ?? '?';

  const apercu = useMemo(() => {
    if (ordre.length === 0) return [];
    return Array.from({ length: Math.min(occurrences, 8) }, (_, i) => ({
      date: addDays(ancre, i * 7),
      gardeId: ordre[i % ordre.length],
    }));
  }, [ancre, ordre, occurrences]);

  async function handleGenerate() {
    if (ordre.length === 0) {
      onError('Ajoute au moins une garde à la rotation.');
      return;
    }
    onError(null);
    setGenerating(true);
    setProgress({ done: 0, total: occurrences });
    try {
      for (let i = 0; i < occurrences; i++) {
        await setGardeSemaine(addDays(ancre, i * 7), ordre[i % ordre.length]);
        setProgress({ done: i + 1, total: occurrences });
      }
      showToast(`${occurrences} semaine(s) planifiée(s).`);
    } catch (err) {
      console.error(err);
      onError('La génération de la rotation a échoué en cours de route — vérifie le Planning, une partie a peut-être été enregistrée.');
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  }

  return (
    <Card accent="brand">
      <strong style={{ fontSize: 14 }}>Rotation automatique</strong>
      <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 4 }}>
        Planifie d'un coup la garde de service sur plusieurs semaines, au lieu de la choisir une par
        une dans le Planning. Utile pour une rotation qui revient toujours dans le même ordre (ex. 4
        gardes qui tournent toutes les 4 semaines).
      </p>

      <div className="field-row" style={{ marginTop: 12 }}>
        <div className="view-toggle">
          <button className={cible === 'semaine' ? 'view-toggle-btn active' : 'view-toggle-btn'} onClick={() => setCible('semaine')}>
            Nuit (Lun–Jeu)
          </button>
          <button className={cible === 'weekend' ? 'view-toggle-btn active' : 'view-toggle-btn'} onClick={() => setCible('weekend')}>
            Week-end (Ven nuit–Dim nuit)
          </button>
        </div>
        <Field label="Première occurrence à partir du" style={{ maxWidth: 180 }}>
          <input type="date" className="input" value={dateDepart} onChange={(e) => setDateDepart(e.target.value)} />
        </Field>
        <Field label="Nombre de semaines à générer" style={{ maxWidth: 160 }}>
          <input
            type="number"
            className="input"
            min={1}
            max={104}
            value={occurrences}
            onChange={(e) => setOccurrences(Math.max(1, Math.min(104, Number(e.target.value) || 1)))}
          />
        </Field>
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="field-label" style={{ marginBottom: 6 }}>Ordre du cycle</div>
        {ordre.length === 0 && (
          <p style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Crée d'abord au moins une garde ci-dessous.</p>
        )}
        <div className="stack-sm">
          {ordre.map((id, i) => (
            <div key={id} className="list-row" style={{ padding: '6px 0' }}>
              <span><span className="mono" style={{ color: 'var(--text-3)' }}>{i + 1}.</span> {gardeNom(id)}</span>
              <span style={{ display: 'flex', gap: 4 }}>
                <button className="icon-btn" style={{ width: 28, height: 28 }} aria-label="Monter" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button className="icon-btn" style={{ width: 28, height: 28 }} aria-label="Descendre" disabled={i === ordre.length - 1} onClick={() => move(i, 1)}>↓</button>
              </span>
            </div>
          ))}
        </div>
      </div>

      {apercu.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="field-label" style={{ marginBottom: 6 }}>
            Aperçu {occurrences > apercu.length ? `(${apercu.length} premières sur ${occurrences})` : ''}
          </div>
          <div className="stack-sm">
            {apercu.map((p) => (
              <div key={p.date} className="list-row" style={{ padding: '4px 0', fontSize: 12.5 }}>
                <span className="mono">{dayLabel(p.date)}</span>
                <span>{gardeNom(p.gardeId)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <Button onClick={handleGenerate} disabled={generating || ordre.length === 0}>
          {generating
            ? progress
              ? `Génération… ${progress.done}/${progress.total}`
              : 'Génération…'
            : 'Générer la rotation'}
        </Button>
      </div>
    </Card>
  );
}
