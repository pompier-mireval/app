import { useEffect, useState } from 'react';
import {
  fetchGardes,
  createGarde,
  updateGarde,
  deleteGarde,
  assignAgentToGarde,
  removeAgentFromGarde,
  fetchAllAgentGardes,
} from '../api/gardes';
import { fetchAgents } from '../api/agents';
import type { Garde, Agent } from '../lib/types';
import type { AgentGardeLink } from '../api/gardes';
import { Card, ErrorBanner, Spinner, Button, PageHeader, Field, EmptyState } from '../components/ui/Primitives';
import { AgentLink } from '../components/ui/AgentLink';

export function GardesPage() {
  const [gardes, setGardes] = useState<Garde[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [memberships, setMemberships] = useState<AgentGardeLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nomGarde, setNomGarde] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editNom, setEditNom] = useState('');

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
    } catch {
      setError('Impossible de créer cette garde.');
    }
  }

  async function handleSaveGarde(id: string) {
    setError(null);
    try {
      await updateGarde(id, editNom.trim());
      setEditing(null);
      load();
    } catch {
      setError('Impossible de renommer cette garde.');
    }
  }

  async function handleDeleteGarde(id: string) {
    setError(null);
    try {
      await deleteGarde(id);
      load();
    } catch {
      setError('Impossible de supprimer cette garde.');
    }
  }

  async function handleToggle(agentId: string, gardeId: string, isMember: boolean) {
    setError(null);
    try {
      if (isMember) await removeAgentFromGarde(agentId, gardeId);
      else await assignAgentToGarde(agentId, gardeId);
      load();
    } catch {
      setError("Impossible de mettre à jour l'appartenance à la garde.");
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="stack">
      <PageHeader title="Gardes" sub="Crée les équipes d'appartenance et compose-les." />
      {error && <ErrorBanner message={error} />}

      <Card>
        <div className="field-row">
          <Field label="Nouvelle garde">
            <input className="input" placeholder="Garde A" value={nomGarde} onChange={(e) => setNomGarde(e.target.value)} />
          </Field>
          <Button onClick={handleCreateGarde}>Créer</Button>
        </div>
      </Card>

      {gardes.map((g) => (
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
                <span style={{ display: 'flex', gap: 10 }}>
                  <button className="link-edit" onClick={() => { setEditing(g.id); setEditNom(g.nom); }}>renommer</button>
                  <button className="link-delete" onClick={() => handleDeleteGarde(g.id)}>supprimer</button>
                </span>
              </>
            )}
          </div>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            {agents.map((a) => {
              const isMember = memberships.some((m) => m.agent_id === a.id && m.garde_id === g.id);
              return (
                <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={isMember} onChange={() => handleToggle(a.id, g.id, isMember)} />
                  <span onClick={(e) => e.stopPropagation()}>
                    <AgentLink agentId={a.id}>{a.prenom} {a.nom}</AgentLink>
                  </span>
                </label>
              );
            })}
            {agents.length === 0 && <EmptyState>Aucun agent enregistré.</EmptyState>}
          </div>
        </Card>
      ))}
    </div>
  );
}
