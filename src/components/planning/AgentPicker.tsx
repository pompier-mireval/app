import { useState } from 'react';

export interface PickerAgent {
  id: string;
  label: string;
  hint?: string;
  partiel?: boolean;
}

interface Props {
  disponibles: PickerAgent[];
  disabled?: boolean;
  onPick: (agentId: string) => void;
}

// Sélecteur d'agents en un clic : une ligne = un agent, toucher la ligne
// l'affecte directement. Seuls les agents ayant déclaré une disponibilité sur
// ce créneau sont proposés.
export function AgentPicker({ disponibles, disabled = false, onPick }: Props) {
  const [recherche, setRecherche] = useState('');
  const q = recherche.trim().toLowerCase();
  const filtre = (list: PickerAgent[]) => (q ? list.filter((a) => a.label.toLowerCase().includes(q)) : list);
  const dispos = filtre(disponibles);

  const row = (a: PickerAgent) => (
    <button key={a.id} type="button" className="picker-row" disabled={disabled} onClick={() => onPick(a.id)}>
      <span>
        {a.label}
        {a.hint && <span className="choice-hint"> · {a.hint}</span>}
      </span>
      <span className="picker-action" aria-hidden="true">
        {a.partiel && <span className="badge badge-amber">partiel</span>} + Affecter
      </span>
    </button>
  );

  return (
    <div className="stack-sm">
      {disponibles.length > 6 && (
        <input
          className="input"
          placeholder="Rechercher un agent…"
          aria-label="Rechercher un agent"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      )}

      <div className="picker-title">Disponibles ({dispos.length})</div>
      <div className="picker-list" role="list">
        {dispos.map(row)}
        {dispos.length === 0 && (
          <div className="choice-empty">{q ? 'Aucun résultat.' : 'Personne n’a déclaré de disponibilité sur ce créneau.'}</div>
        )}
      </div>
    </div>
  );
}
