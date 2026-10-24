import { useEffect, useMemo, useState } from 'react';
import {
  fetchGardes,
  createGarde,
  updateGarde,
  deleteGarde,
  assignAgentToGarde,
  removeAgentFromGarde,
  fetchAllAgentGardes,
} from '../api/gardes';
import { useAuth } from '../hooks/useAuth';
import { fetchAgents } from '../api/agents';
import type { Garde, Agent } from '../lib/types';
import type { AgentGardeLink } from '../api/gardes';
import { Card, ErrorBanner, Spinner, Button, PageHeader, Field, EmptyState } from '../components/ui/Primitives';
import { IconSearch } from '../components/ui/Icons';
import { AgentLink } from '../components/ui/AgentLink';
import { useToast } from '../components/ui/Toast';
import { confirmAction } from '../lib/confirm';
import { RotationGardes } from '../components/gardes/RotationGardes';

// Une fiche créée par email seul n'a ni nom ni prénom : on affiche l'email
// plutôt qu'une ligne vide.
function nomAffiche(a: Agent): string {
  return `${a.prenom} ${a.nom}`.trim() || a.email;
}

const collator = new Intl.Collator('fr', { sensitivity: 'base' });

export function GardesPage() {
  const { showToast } = useToast();
  const { agent: moi } = useAuth();
  const isSuperadmin = moi?.niveau_acces === 'superadmin';
  const [gardes, setGardes] = useState<Garde[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [memberships, setMemberships] = useState<AgentGardeLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nomGarde, setNomGarde] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editNom, setEditNom] = useState('');
  const [search, setSearch] = useState('');

  // Ordre alphabétique du nom (puis du prénom) ; les fiches sans nom
  // (email seul) passent à la fin, triées par email.
  const agentsTries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agents
      .filter((a) => !q || `${a.prenom} ${a.nom} ${a.email}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const sansNomA = !a.nom.trim();
        const sansNomB = !b.nom.trim();
        if (sansNomA !== sansNomB) return sansNomA ? 1 : -1;
        return (
          collator.compare(a.nom || a.email, b.nom || b.email) || collator.compare(a.prenom, b.prenom)
        );
      });
  }, [agents, search]);

  function load() {
    setLoading(true);
    Promise.all([fetchGardes(), fetchAgents(), fetchAllAgentGardes()])
      .then(([g, a, m]) => {
        setGardes(g);
        setAgents(a);
        setMemberships(m);
      })
      .catch(() => setError('Impossible de charger les gardes.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreateGarde() {
    if (!nomGarde.trim()) {
      setError('Le nom de la garde est requis.');
      return;
    }
    setError(null);
    try {
      await createGarde(nomGarde.trim());
      setNomGarde('');
      load();
      showToast('Garde créée.');
    } catch (err) {
      console.error(err);
      setError('Impossible de créer cette garde.');
    }
  }

  async function handleSaveGarde(id: string) {
    setError(null);
    try {
      await updateGarde(id, editNom.trim());
      setEditing(null);
      load();
      showToast('Garde renommée.');
    } catch (err) {
      console.error(err);
      setError('Impossible de renommer cette garde.');
    }
  }

  async function handleDeleteGarde(id: string) {
    if (!confirmAction('Supprimer cette garde ?')) return;
    setError(null);
    try {
      await deleteGarde(id);
      load();
      showToast('Garde supprimée.');
    } catch (err) {
      console.error(err);
      setError('Impossible de supprimer cette garde.');
    }
  }

  async function handleToggle(agentId: string, gardeId: string, isMember: boolean) {
    setError(null);
    try {
      if (isMember) await removeAgentFromGarde(agentId, gardeId);
      else await assignAgentToGarde(agentId, gardeId);
      load();
    } catch (err) {
      console.error(err);
      setError("Impossible de mettre à jour l'appartenance à la garde.");
    }
  }

  if (loading) return <Spinner />;

  // Un admin (chef de garde) ne gère que les gardes dont il est membre.
  const gardesVisibles = isSuperadmin
    ? gardes
    : gardes.filter((g) => memberships.some((m) => m.agent_id === moi?.id && m.garde_id === g.id));

  return (
    <div className="stack">
      <PageHeader
        title="Gardes"
        sub={isSuperadmin ? "Crée les équipes d'appartenance et compose-les." : "Ajoute ou retire des agents dans tes gardes."}
      />
      {error && <ErrorBanner message={error} />}

      {isSuperadmin && (
      <Card>
        <div className="field-row">
          <Field label="Nouvelle garde">
            <input className="input" placeholder="Garde A" value={nomGarde} onChange={(e) => setNomGarde(e.target.value)} />
          </Field>
          <Button onClick={handleCreateGarde}>Créer</Button>
        </div>
      </Card>
      )}

      {isSuperadmin && <RotationGardes gardes={gardes} onError={setError} />}

      {!isSuperadmin && gardesVisibles.length === 0 && (
        <EmptyState>Tu n'es membre d'aucune garde : demande au superadmin de t'y ajouter.</EmptyState>
      )}

      <div className="input-search-wrap">
        <IconSearch className="input-search-icon" />
        <input
          className="input"
          placeholder="Rechercher un agent (nom, prénom, email)…"
          aria-label="Rechercher un agent"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {gardesVisibles.map((g) => (
        <Card key={g.id} accent="brand">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            {editing === g.id ? (
              <div className="field-row" style={{ flex: 1 }}>
                <input className="input" style={{ flex: 1 }} value={editNom} onChange={(e) => setEditNom(e.target.value)} />
                <Button onClick={() => handleSaveGarde(g.id)}>Enregistrer</Button>
                <Button variant="secondary" onClick={() => setEditing(null)}>Annuler</Button>
              </div>
            ) : (
              <>
                <strong>{g.nom}</strong>
                {isSuperadmin && (
                  <span style={{ display: 'flex', gap: 10 }}>
                    <button className="link-edit" onClick={() => { setEditing(g.id); setEditNom(g.nom); }}>renommer</button>
                    <button className="link-delete" onClick={() => handleDeleteGarde(g.id)}>supprimer</button>
                  </span>
                )}
              </>
            )}
          </div>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            {agentsTries.map((a) => {
              const isMember = memberships.some((m) => m.agent_id === a.id && m.garde_id === g.id);
              return (
                <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={isMember} disabled={!isSuperadmin && a.id === moi?.id} onChange={() => handleToggle(a.id, g.id, isMember)} />
                  <span onClick={(e) => e.stopPropagation()}>
                    <AgentLink agentId={a.id}>{nomAffiche(a)}</AgentLink>
                  </span>
                </label>
              );
            })}
            {agentsTries.length === 0 && (
              <EmptyState>{search.trim() ? 'Aucun agent ne correspond à cette recherche.' : 'Aucun agent enregistré.'}</EmptyState>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
