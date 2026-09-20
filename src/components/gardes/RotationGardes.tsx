import { useEffect, useMemo, useState } from 'react';
import { setGardeSemaine } from '../../api/gardeSemaines';
import { todayIso, addDays, mondayOf, fridayOf, dayLabel } from '../../lib/dates';
import type { Garde, GardeSemaineType } from '../../lib/types';
import { Card, Field, Button } from '../ui/Primitives';
import { useToast } from '../ui/Toast';

const CIBLES: { value: GardeSemaineType; label: string; hint: string }[] = [
  { value: 'jour', label: 'Jour (Lun–Ven)', hint: "Ne tourne pas : mets une seule garde ici pour qu'elle reste la même chaque semaine." },
  { value: 'nuit', label: 'Nuit (Lun–Jeu)', hint: 'Tourne selon l’ordre choisi ci-dessous (ex. 4 gardes → rotation toutes les 4 semaines).' },
  { value: 'weekend', label: 'Week-end (Ven nuit–Dim nuit)', hint: 'Tourne selon l’ordre choisi ci-dessous.' },
];

type Ordres = Record<GardeSemaineType, string[]>;
const EMPTY_ORDRES: Ordres = { jour: [], nuit: [], weekend: [] };

// Génère en une fois la garde de service de plusieurs semaines à venir,
// au lieu de choisir une garde à la main semaine par semaine dans le
// Planning. Les 3 créneaux (jour / nuit / week-end, voir schema_v3.sql)
// ont chacun leur propre cycle : le jour n'est volontairement PAS
// pré-rempli avec toutes les gardes (il ne doit pas tourner), contrairement
// à une tentative précédente qui incluait toutes les gardes par défaut
// dans chaque cycle.
export function RotationGardes({ gardes, onError }: { gardes: Garde[]; onError: (msg: string | null) => void }) {
  const { showToast } = useToast();
  const [cible, setCible] = useState<GardeSemaineType>('nuit');
  const [dateDepart, setDateDepart] = useState(todayIso());
  const [ordres, setOrdres] = useState<Ordres>(EMPTY_ORDRES);
  const [occurrences, setOccurrences] = useState(12);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // Si une garde est supprimée depuis la page, on la retire de tous les
  // cycles où elle apparaissait — mais on n'ajoute jamais automatiquement
  // une garde nouvellement créée à un cycle : l'inclusion est toujours un
  // choix explicite (voir toggleInclude).
  useEffect(() => {
    setOrdres((prev) => {
      const fix = (list: string[]) => list.filter((id) => gardes.some((g) => g.id === id));
      return { jour: fix(prev.jour), nuit: fix(prev.nuit), weekend: fix(prev.weekend) };
    });
  }, [gardes]);

  const ordre = ordres[cible];
  const included = new Set(ordre);
  const disponibles = gardes.filter((g) => !included.has(g.id));

  function setOrdre(next: string[]) {
    setOrdres((prev) => ({ ...prev, [cible]: next }));
  }
  function addToCycle(id: string) {
    setOrdre([...ordre, id]);
  }
  function removeFromCycle(id: string) {
    setOrdre(ordre.filter((x) => x !== id));
  }
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= ordre.length) return;
    const next = [...ordre];
    [next[index], next[target]] = [next[target], next[index]];
    setOrdre(next);
  }

  const ancre = cible === 'weekend' ? fridayOf(dateDepart) : mondayOf(dateDepart);
  const gardeNom = (id: string) => gardes.find((g) => g.id === id)?.nom ?? '?';
  const cibleInfo = CIBLES.find((c) => c.value === cible)!;

  const apercu = useMemo(() => {
    if (ordre.length === 0) return [];
    return Array.from({ length: Math.min(occurrences, 8) }, (_, i) => ({
      date: addDays(ancre, i * 7),
      gardeId: ordre[i % ordre.length],
    }));
  }, [ancre, ordre, occurrences]);

  async function handleGenerate() {
    if (ordre.length === 0) {
      onError('Ajoute au moins une garde à ce cycle.');
      return;
    }
    onError(null);
    setGenerating(true);
    setProgress({ done: 0, total: occurrences });
    try {
      for (let i = 0; i < occurrences; i++) {
        await setGardeSemaine(addDays(ancre, i * 7), cible, ordre[i % ordre.length]);
        setProgress({ done: i + 1, total: occurrences });
      }
      showToast(`${occurrences} semaine(s) planifiée(s) pour "${cibleInfo.label}".`);
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
        une dans le Planning. Les trois créneaux ont chacun leur propre cycle, réglé séparément.
      </p>

      <div className="view-toggle" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        {CIBLES.map((c) => (
          <button key={c.value} className={cible === c.value ? 'view-toggle-btn active' : 'view-toggle-btn'} onClick={() => setCible(c.value)}>
            {c.label}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>{cibleInfo.hint}</p>

      <div className="field-row" style={{ marginTop: 12 }}>
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
        <div className="field-label" style={{ marginBottom: 6 }}>Gardes dans ce cycle, dans l'ordre</div>
        {ordre.length === 0 && (
          <p style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Aucune garde dans ce cycle pour l'instant — ajoutes-en ci-dessous.</p>
        )}
        <div className="stack-sm">
          {ordre.map((id, i) => (
            <div key={id} className="list-row" style={{ padding: '6px 0' }}>
              <span><span className="mono" style={{ color: 'var(--text-3)' }}>{i + 1}.</span> {gardeNom(id)}</span>
              <span style={{ display: 'flex', gap: 4 }}>
                <button className="icon-btn" style={{ width: 28, height: 28 }} aria-label="Monter" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button className="icon-btn" style={{ width: 28, height: 28 }} aria-label="Descendre" disabled={i === ordre.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button className="link-delete" onClick={() => removeFromCycle(id)}>retirer</button>
              </span>
            </div>
          ))}
        </div>

        {disponibles.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {disponibles.map((g) => (
              <button key={g.id} type="button" className="checkbox-pill" onClick={() => addToCycle(g.id)}>
                + {g.nom}
              </button>
            ))}
          </div>
        )}
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
