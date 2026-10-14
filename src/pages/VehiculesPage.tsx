import { useEffect, useState } from 'react';
import {
  fetchVehicules,
  createVehicule,
  setVehiculeDansPlanning,
  updateVehicule,
  deleteVehicule,
  fetchPostesForVehicule,
  addPosteToVehicule,
  updatePosteNom,
  deletePoste,
  addPosteCompetence,
  removePosteCompetence,
  fetchAllPostesCompetences,
  saveVehiculesOrder,
  saveVehiculesGenerationOrder,
} from '../api/vehicules';
import { fetchCompetences } from '../api/competences';
import type { Vehicule, PosteVehicule, Competence } from '../lib/types';
import type { PosteCompetenceLink } from '../api/vehicules';
import { Card, ErrorBanner, Spinner, Button, PageHeader, Field, EmptyState } from '../components/ui/Primitives';
import { useToast } from '../components/ui/Toast';
import { confirmAction } from '../lib/confirm';

export function VehiculesPage() {
  const { showToast } = useToast();
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [competences, setCompetences] = useState<Competence[]>([]);
  const [postesByVehicule, setPostesByVehicule] = useState<Record<string, PosteVehicule[]>>({});
  const [postesCompetences, setPostesCompetences] = useState<PosteCompetenceLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [type, setType] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [v, c, pc] = await Promise.all([fetchVehicules(), fetchCompetences(), fetchAllPostesCompetences()]);
      setVehicules(v);
      setCompetences(c);
      setPostesCompetences(pc);
      const entries = await Promise.all(v.map(async (veh) => [veh.id, await fetchPostesForVehicule(veh.id)] as const));
      setPostesByVehicule(Object.fromEntries(entries));
    } catch (err) {
      console.error(err);
      setError('Impossible de charger les véhicules.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    if (!nom.trim()) {
      setError('Le nom du véhicule est requis.');
      return;
    }
    setError(null);
    try {
      await createVehicule({ nom: nom.trim(), type: type.trim() || null, immatriculation: null });
      setNom('');
      setType('');
      load();
      showToast('Véhicule créé.');
    } catch (err) {
      console.error(err);
      setError('Impossible de créer ce véhicule.');
    }
  }

  async function handleMove(index: number, delta: -1 | 1) {
    const j = index + delta;
    if (j < 0 || j >= vehicules.length) return;
    const ids = vehicules.map((v) => v.id);
    [ids[index], ids[j]] = [ids[j], ids[index]];
    setVehicules(ids.map((id) => vehicules.find((v) => v.id === id)!));
    try {
      await saveVehiculesOrder(ids);
    } catch (err) {
      console.error(err);
      setError("Impossible d'enregistrer l'ordre des véhicules.");
      load();
    }
  }

  const parGeneration = [...vehicules].sort((a, b) => a.ordre_generation - b.ordre_generation || a.nom.localeCompare(b.nom));

  async function handleMoveGeneration(index: number, delta: -1 | 1) {
    const j = index + delta;
    if (j < 0 || j >= parGeneration.length) return;
    const ids = parGeneration.map((v) => v.id);
    [ids[index], ids[j]] = [ids[j], ids[index]];
    setVehicules((prev) => prev.map((v) => ({ ...v, ordre_generation: ids.indexOf(v.id) + 1 })));
    try {
      await saveVehiculesGenerationOrder(ids);
    } catch (err) {
      console.error(err);
      setError("Impossible d'enregistrer l'ordre de génération.");
      load();
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="stack">
      <PageHeader title="Véhicules" sub="Chaque véhicule définit ses postes et les compétences requises pour les occuper." />
      {error && <ErrorBanner message={error} />}

      <Card>
        <div className="field-row">
          <Field label="Nom">
            <input className="input" placeholder="VSAV 1" value={nom} onChange={(e) => setNom(e.target.value)} />
          </Field>
          <Field label="Type">
            <input className="input" placeholder="VSAV" value={type} onChange={(e) => setType(e.target.value)} />
          </Field>
          <Button onClick={handleCreate}>Créer</Button>
        </div>
      </Card>

      {parGeneration.length > 1 && (
        <Card>
          <strong>Ordre de remplissage (génération automatique)</strong>
          <div style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 8px' }}>
            Le premier véhicule de la liste est rempli en premier, avec les agents les moins chargés.
          </div>
          <div className="stack-sm">
            {parGeneration.map((v, i) => (
              <div key={v.id} className="list-row">
                <span>{i + 1}. {v.nom}</span>
                <span style={{ display: 'flex', gap: 10 }}>
                  <button className="link-edit" disabled={i === 0} onClick={() => handleMoveGeneration(i, -1)} aria-label="Monter">▲</button>
                  <button className="link-edit" disabled={i === parGeneration.length - 1} onClick={() => handleMoveGeneration(i, 1)} aria-label="Descendre">▼</button>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {vehicules.map((v, i) => (
        <VehiculeCard
          key={v.id}
          onMove={(delta) => handleMove(i, delta)}
          canMoveUp={i > 0}
          canMoveDown={i < vehicules.length - 1}
          vehicule={v}
          competences={competences}
          postes={postesByVehicule[v.id] ?? []}
          postesCompetences={postesCompetences}
          onChanged={load}
          onError={setError}
        />
      ))}
    </div>
  );
}

interface VehiculeCardProps {
  vehicule: Vehicule;
  competences: Competence[];
  postes: PosteVehicule[];
  postesCompetences: PosteCompetenceLink[];
  onChanged: () => void;
  onError: (msg: string) => void;
  onMove: (delta: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

function VehiculeCard({ vehicule, competences, postes, postesCompetences, onChanged, onError, onMove, canMoveUp, canMoveDown }: VehiculeCardProps) {
  const { showToast } = useToast();
  const [nomPoste, setNomPoste] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [editingVehicule, setEditingVehicule] = useState(false);
  const [editNom, setEditNom] = useState(vehicule.nom);
  const [editType, setEditType] = useState(vehicule.type ?? '');
  const [editingPoste, setEditingPoste] = useState<string | null>(null);
  const [editPosteNom, setEditPosteNom] = useState('');

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleAddPoste() {
    if (!nomPoste.trim()) {
      onError('Le nom du poste est requis.');
      return;
    }
    try {
      await addPosteToVehicule(vehicule.id, nomPoste.trim(), postes.length, selected);
      setNomPoste('');
      setSelected([]);
      onChanged();
      showToast('Poste ajouté.');
    } catch (err) {
      console.error(err);
      onError('Impossible de créer ce poste.');
    }
  }

  async function handleSaveVehicule() {
    try {
      await updateVehicule(vehicule.id, {
        nom: editNom.trim(),
        type: editType.trim() || null,
        immatriculation: vehicule.immatriculation,
        statut: vehicule.statut,
      });
      setEditingVehicule(false);
      onChanged();
      showToast('Véhicule modifié.');
    } catch (err) {
      console.error(err);
      onError('Impossible de modifier ce véhicule.');
    }
  }

  async function handleTogglePlanning() {
    try {
      await setVehiculeDansPlanning(vehicule.id, vehicule.dans_planning === false);
      onChanged();
    } catch (err) {
      console.error(err);
      onError('Impossible de modifier ce véhicule.');
    }
  }

  async function handleDeleteVehicule() {
    if (!confirmAction(`Supprimer le véhicule "${vehicule.nom}" et tous ses postes ?`)) return;
    try {
      await deleteVehicule(vehicule.id);
      onChanged();
      showToast('Véhicule supprimé.');
    } catch (err) {
      console.error(err);
      onError('Impossible de supprimer ce véhicule.');
    }
  }

  async function handleSavePosteNom(posteId: string) {
    try {
      await updatePosteNom(posteId, editPosteNom.trim());
      setEditingPoste(null);
      onChanged();
      showToast('Poste renommé.');
    } catch (err) {
      console.error(err);
      onError('Impossible de renommer ce poste.');
    }
  }

  async function handleDeletePoste(posteId: string) {
    if (!confirmAction('Supprimer ce poste ?')) return;
    try {
      await deletePoste(posteId);
      onChanged();
      showToast('Poste supprimé.');
    } catch (err) {
      console.error(err);
      onError('Impossible de supprimer ce poste.');
    }
  }

  async function handleTogglePosteCompetence(posteId: string, competenceId: string, hasIt: boolean) {
    try {
      if (hasIt) await removePosteCompetence(posteId, competenceId);
      else await addPosteCompetence(posteId, competenceId);
      onChanged();
    } catch (err) {
      console.error(err);
      onError('Impossible de mettre à jour les compétences de ce poste.');
    }
  }

  return (
    <Card accent="brand">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: 8 }}>
        {editingVehicule ? (
          <div className="field-row" style={{ flex: 1 }}>
            <input className="input" style={{ maxWidth: 150 }} value={editNom} onChange={(e) => setEditNom(e.target.value)} placeholder="Nom" />
            <input className="input" style={{ maxWidth: 120 }} value={editType} onChange={(e) => setEditType(e.target.value)} placeholder="Type" />
            <Button onClick={handleSaveVehicule}>Enregistrer</Button>
            <Button variant="secondary" onClick={() => setEditingVehicule(false)}>Annuler</Button>
          </div>
        ) : (
          <div>
            <div className="card-head-line">
              <span className="card-head-arrows">
                <button className="link-edit" disabled={!canMoveUp} onClick={() => onMove(-1)} aria-label="Monter" title="Monter">▲</button>
                <button className="link-edit" disabled={!canMoveDown} onClick={() => onMove(1)} aria-label="Descendre" title="Descendre">▼</button>
              </span>
              <strong>{vehicule.nom}</strong>
              <span className="card-head-actions">
                <button className="link-edit" onClick={() => setEditingVehicule(true)}>modifier</button>
                <button className="link-delete" onClick={handleDeleteVehicule}>supprimer</button>
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{vehicule.type ?? '—'} · {vehicule.statut}</div>
            <label className="checkbox-pill" style={{ marginTop: 6 }}>
              <input type="checkbox" checked={vehicule.dans_planning !== false} onChange={handleTogglePlanning} />
              Pris en compte dans le planning
            </label>
          </div>
        )}
      </div>

      <button
        type="button"
        className="btn-secondary section-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>Postes et compétences ({postes.length})</span>
        <span aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>

      {open && (<>
      <div className="stack-sm" style={{ marginTop: 12 }}>
        {postes.map((p) => {
          const required = postesCompetences.filter((pc) => pc.poste_id === p.id).map((pc) => pc.competence_id);
          return (
            <div key={p.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                {editingPoste === p.id ? (
                  <div className="field-row" style={{ flex: 1 }}>
                    <input className="input" style={{ flex: 1 }} value={editPosteNom} onChange={(e) => setEditPosteNom(e.target.value)} />
                    <Button onClick={() => handleSavePosteNom(p.id)}>Enregistrer</Button>
                    <Button variant="secondary" onClick={() => setEditingPoste(null)}>Annuler</Button>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: 13 }}>{p.nom_poste}</span>
                    <span style={{ display: 'flex', gap: 10 }}>
                      <button className="link-edit" onClick={() => { setEditingPoste(p.id); setEditPosteNom(p.nom_poste); }}>renommer</button>
                      <button className="link-delete" onClick={() => handleDeletePoste(p.id)}>supprimer</button>
                    </span>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {competences.map((c) => (
                  <label key={c.id} className="checkbox-pill">
                    <input
                      type="checkbox"
                      checked={required.includes(c.id)}
                      onChange={() => handleTogglePosteCompetence(p.id, c.id, required.includes(c.id))}
                    />
                    {c.nom}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
        {postes.length === 0 && <EmptyState>Aucun poste défini.</EmptyState>}
      </div>

      <div className="stack-sm" style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <input
          className="input"
          placeholder="Nom du nouveau poste (ex: Conducteur)"
          value={nomPoste}
          onChange={(e) => setNomPoste(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {competences.map((c) => (
            <label key={c.id} className="checkbox-pill">
              <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
              {c.nom}
            </label>
          ))}
          {competences.length === 0 && (
            <EmptyState>Aucune compétence définie — crée-en depuis la page Référentiels.</EmptyState>
          )}
        </div>
        <Button onClick={handleAddPoste}>Ajouter le poste</Button>
      </div>
      </>)}
    </Card>
  );
}
