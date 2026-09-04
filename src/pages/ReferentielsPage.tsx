import { useEffect, useState } from 'react';
import { fetchCompetences, createCompetence, updateCompetence, deleteCompetence } from '../api/competences';
import { fetchCreneauxTypes, createCreneauType, updateCreneauType, deleteCreneauType } from '../api/creneaux';
import { fetchGrades, createGrade, updateGrade, deleteGrade } from '../api/grades';
import type { Competence, CreneauType, Grade } from '../lib/types';
import { Card, ErrorBanner, Spinner, Button, PageHeader, Field } from '../components/ui/Primitives';
import { useToast } from '../components/ui/Toast';
import { confirmAction } from '../lib/confirm';

export function ReferentielsPage() {
  const { showToast } = useToast();
  const [competences, setCompetences] = useState<Competence[]>([]);
  const [creneaux, setCreneaux] = useState<CreneauType[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [nomCompetence, setNomCompetence] = useState('');
  const [editingCompetence, setEditingCompetence] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editNomCompetence, setEditNomCompetence] = useState('');

  const [nomCreneau, setNomCreneau] = useState('');
  const [heureDebut, setHeureDebut] = useState('07:00');
  const [heureFin, setHeureFin] = useState('19:00');
  const [editingCreneau, setEditingCreneau] = useState<string | null>(null);
  const [editNomCreneau, setEditNomCreneau] = useState('');
  const [editDebut, setEditDebut] = useState('');
  const [editFin, setEditFin] = useState('');

  const [nomGrade, setNomGrade] = useState('');
  const [ordreGrade, setOrdreGrade] = useState(0);
  const [editingGrade, setEditingGrade] = useState<string | null>(null);
  const [editNomGrade, setEditNomGrade] = useState('');
  const [editOrdreGrade, setEditOrdreGrade] = useState(0);

  function load() {
    setLoading(true);
    Promise.all([fetchCompetences(), fetchCreneauxTypes(), fetchGrades()])
      .then(([c, cr, g]) => {
        setCompetences(c);
        setCreneaux(cr);
        setGrades(g);
      })
      .catch(() => setError('Impossible de charger les référentiels.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreateCompetence() {
    if (!code.trim() || !nomCompetence.trim()) {
      setError('Code et nom sont requis.');
      return;
    }
    setError(null);
    try {
      await createCompetence(code.trim().toUpperCase(), nomCompetence.trim());
      setCode('');
      setNomCompetence('');
      load();
      showToast('Compétence créée.');
    } catch (err) {
      console.error(err);
      setError('Impossible de créer cette compétence (le code existe peut-être déjà).');
    }
  }

  function startEditCompetence(c: Competence) {
    setEditingCompetence(c.id);
    setEditCode(c.code);
    setEditNomCompetence(c.nom);
  }

  async function handleSaveCompetence(id: string) {
    setError(null);
    try {
      await updateCompetence(id, editCode.trim().toUpperCase(), editNomCompetence.trim());
      setEditingCompetence(null);
      load();
      showToast('Compétence modifiée.');
    } catch (err) {
      console.error(err);
      setError('Impossible de modifier cette compétence.');
    }
  }

  async function handleDeleteCompetence(id: string) {
    if (!confirmAction('Supprimer cette compétence ?')) return;
    setError(null);
    try {
      await deleteCompetence(id);
      load();
      showToast('Compétence supprimée.');
    } catch (err) {
      console.error(err);
      setError('Impossible de supprimer cette compétence : elle est probablement utilisée par un agent ou un poste.');
    }
  }

  async function handleCreateCreneau() {
    if (!nomCreneau.trim()) {
      setError('Le nom du créneau est requis.');
      return;
    }
    setError(null);
    try {
      await createCreneauType(nomCreneau.trim(), heureDebut, heureFin);
      setNomCreneau('');
      load();
      showToast('Créneau créé.');
    } catch (err) {
      console.error(err);
      setError('Impossible de créer ce créneau.');
    }
  }

  function startEditCreneau(c: CreneauType) {
    setEditingCreneau(c.id);
    setEditNomCreneau(c.nom);
    setEditDebut(c.heure_debut);
    setEditFin(c.heure_fin);
  }

  async function handleSaveCreneau(id: string) {
    setError(null);
    try {
      await updateCreneauType(id, editNomCreneau.trim(), editDebut, editFin);
      setEditingCreneau(null);
      load();
      showToast('Créneau modifié.');
    } catch (err) {
      console.error(err);
      setError('Impossible de modifier ce créneau.');
    }
  }

  async function handleDeleteCreneau(id: string) {
    if (!confirmAction('Supprimer ce créneau ?')) return;
    setError(null);
    try {
      await deleteCreneauType(id);
      load();
      showToast('Créneau supprimé.');
    } catch (err) {
      console.error(err);
      setError('Impossible de supprimer ce créneau : il est probablement utilisé par une disponibilité ou une affectation.');
    }
  }

  async function handleCreateGrade() {
    if (!nomGrade.trim()) {
      setError('Le nom du grade est requis.');
      return;
    }
    setError(null);
    try {
      await createGrade(nomGrade.trim(), ordreGrade);
      setNomGrade('');
      setOrdreGrade(0);
      load();
      showToast('Grade créé.');
    } catch (err) {
      console.error(err);
      setError('Impossible de créer ce grade.');
    }
  }

  function startEditGrade(g: Grade) {
    setEditingGrade(g.id);
    setEditNomGrade(g.nom);
    setEditOrdreGrade(g.ordre);
  }

  async function handleSaveGrade(id: string) {
    setError(null);
    try {
      await updateGrade(id, editNomGrade.trim(), editOrdreGrade);
      setEditingGrade(null);
      load();
      showToast('Grade modifié.');
    } catch (err) {
      console.error(err);
      setError('Impossible de modifier ce grade.');
    }
  }

  async function handleDeleteGrade(id: string) {
    if (!confirmAction('Supprimer ce grade ?')) return;
    setError(null);
    try {
      await deleteGrade(id);
      load();
      showToast('Grade supprimé.');
    } catch (err) {
      console.error(err);
      setError('Impossible de supprimer ce grade : il est probablement attribué à un agent.');
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="stack">
      <PageHeader title="Référentiels" sub="Le socle partagé par toute l'app : compétences et créneaux réutilisables." />
      {error && <ErrorBanner message={error} />}

      <Card>
        <strong style={{ fontSize: 13 }}>Compétences</strong>
        <div className="field-row" style={{ marginTop: 10 }}>
          <Field label="Code" style={{ maxWidth: 100 }}>
            <input className="input" placeholder="COND" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field label="Nom">
            <input className="input" placeholder="Conducteur" value={nomCompetence} onChange={(e) => setNomCompetence(e.target.value)} />
          </Field>
          <Button onClick={handleCreateCompetence}>Ajouter</Button>
        </div>

        <div className="stack-sm" style={{ marginTop: 14 }}>
          {competences.map((c) => (
            <div key={c.id} className="list-row">
              {editingCompetence === c.id ? (
                <div className="field-row" style={{ flex: 1 }}>
                  <input className="input" style={{ maxWidth: 90 }} value={editCode} onChange={(e) => setEditCode(e.target.value)} />
                  <input className="input" style={{ flex: 1 }} value={editNomCompetence} onChange={(e) => setEditNomCompetence(e.target.value)} />
                  <Button onClick={() => handleSaveCompetence(c.id)}>Enregistrer</Button>
                  <Button variant="secondary" onClick={() => setEditingCompetence(null)}>Annuler</Button>
                </div>
              ) : (
                <>
                  <span><span className="mono">{c.code}</span> — {c.nom}</span>
                  <span style={{ display: 'flex', gap: 10 }}>
                    <button className="link-edit" onClick={() => startEditCompetence(c)}>modifier</button>
                    <button className="link-delete" onClick={() => handleDeleteCompetence(c.id)}>supprimer</button>
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <strong style={{ fontSize: 13 }}>Créneaux types</strong>
        <div className="field-row" style={{ marginTop: 10 }}>
          <Field label="Nom">
            <input className="input" placeholder="Journée" value={nomCreneau} onChange={(e) => setNomCreneau(e.target.value)} />
          </Field>
          <Field label="Début">
            <input type="time" className="input" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} />
          </Field>
          <Field label="Fin">
            <input type="time" className="input" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} />
          </Field>
          <Button onClick={handleCreateCreneau}>Ajouter</Button>
        </div>

        <div className="stack-sm" style={{ marginTop: 14 }}>
          {creneaux.map((c) => (
            <div key={c.id} className="list-row">
              {editingCreneau === c.id ? (
                <div className="field-row" style={{ flex: 1 }}>
                  <input className="input" style={{ flex: 1 }} value={editNomCreneau} onChange={(e) => setEditNomCreneau(e.target.value)} />
                  <input type="time" className="input" value={editDebut} onChange={(e) => setEditDebut(e.target.value)} />
                  <input type="time" className="input" value={editFin} onChange={(e) => setEditFin(e.target.value)} />
                  <Button onClick={() => handleSaveCreneau(c.id)}>Enregistrer</Button>
                  <Button variant="secondary" onClick={() => setEditingCreneau(null)}>Annuler</Button>
                </div>
              ) : (
                <>
                  <span>{c.nom} <span className="mono">{c.heure_debut}–{c.heure_fin}</span></span>
                  <span style={{ display: 'flex', gap: 10 }}>
                    <button className="link-edit" onClick={() => startEditCreneau(c)}>modifier</button>
                    <button className="link-delete" onClick={() => handleDeleteCreneau(c.id)}>supprimer</button>
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <strong style={{ fontSize: 13 }}>Grades</strong>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
          L'ordre détermine le tri hiérarchique à l'affichage (0 = le plus bas).
        </p>
        <div className="field-row" style={{ marginTop: 10 }}>
          <Field label="Nom">
            <input className="input" placeholder="Sergent" value={nomGrade} onChange={(e) => setNomGrade(e.target.value)} />
          </Field>
          <Field label="Ordre" style={{ maxWidth: 90 }}>
            <input type="number" className="input" value={ordreGrade} onChange={(e) => setOrdreGrade(Number(e.target.value))} />
          </Field>
          <Button onClick={handleCreateGrade}>Ajouter</Button>
        </div>

        <div className="stack-sm" style={{ marginTop: 14 }}>
          {grades.map((g) => (
            <div key={g.id} className="list-row">
              {editingGrade === g.id ? (
                <div className="field-row" style={{ flex: 1 }}>
                  <input className="input" style={{ flex: 1 }} value={editNomGrade} onChange={(e) => setEditNomGrade(e.target.value)} />
                  <input type="number" className="input" style={{ maxWidth: 80 }} value={editOrdreGrade} onChange={(e) => setEditOrdreGrade(Number(e.target.value))} />
                  <Button onClick={() => handleSaveGrade(g.id)}>Enregistrer</Button>
                  <Button variant="secondary" onClick={() => setEditingGrade(null)}>Annuler</Button>
                </div>
              ) : (
                <>
                  <span>{g.nom} <span className="mono" style={{ color: 'var(--text-3)' }}>#{g.ordre}</span></span>
                  <span style={{ display: 'flex', gap: 10 }}>
                    <button className="link-edit" onClick={() => startEditGrade(g)}>modifier</button>
                    <button className="link-delete" onClick={() => handleDeleteGrade(g.id)}>supprimer</button>
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
