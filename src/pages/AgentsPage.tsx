import { useEffect, useMemo, useState } from 'react';
import { fetchAgents, updateAgentIdentity, setAgentActif, updateNiveauAcces, updateAgentGrade } from '../api/agents';
import { fetchCompetences, grantCompetence, revokeCompetence, fetchAllAgentCompetences } from '../api/competences';
import { fetchAllAgentGardes } from '../api/gardes';
import { fetchGrades } from '../api/grades';
import type { AgentGardeLink } from '../api/gardes';
import type { Agent, Competence, AgentCompetence, NiveauAcces, Grade } from '../lib/types';
import { scopeAgentsToMyGardes } from '../lib/scope';
import { useAuth } from '../hooks/useAuth';
import { AgentLink } from '../components/ui/AgentLink';
import { Card, ErrorBanner, Spinner, Badge, PageHeader, EmptyState, Button } from '../components/ui/Primitives';
import { useToast } from '../components/ui/Toast';
import { confirmAction } from '../lib/confirm';
import { IconSearch } from '../components/ui/Icons';

const NIVEAUX: NiveauAcces[] = ['utilisateur', 'admin', 'superadmin'];

export function AgentsPage() {
  const { agent: moi } = useAuth();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentGardes, setAgentGardes] = useState<AgentGardeLink[]>([]);
  const [competences, setCompetences] = useState<Competence[]>([]);
  const [agentCompetences, setAgentCompetences] = useState<AgentCompetence[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editNom, setEditNom] = useState('');
  const [editPrenom, setEditPrenom] = useState('');

  function load() {
    setLoading(true);
    Promise.all([fetchAgents(), fetchCompetences(), fetchAllAgentCompetences(), fetchAllAgentGardes(), fetchGrades()])
      .then(([a, c, ac, ag, g]) => {
        setAgents(a);
        setCompetences(c);
        setAgentCompetences(ac);
        setAgentGardes(ag);
        setGrades(g);
      })
      .catch(() => setError('Impossible de charger la liste des agents.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const visibleAgents = useMemo(
    () => scopeAgentsToMyGardes(agents, agentGardes, moi),
    [agents, agentGardes, moi]
  );

  const filteredAgents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visibleAgents;
    return visibleAgents.filter((a) => `${a.prenom} ${a.nom} ${a.email}`.toLowerCase().includes(q));
  }, [visibleAgents, search]);

  async function handleToggleCompetence(agentId: string, competenceId: string, hasIt: boolean) {
    setError(null);
    try {
      if (hasIt) await revokeCompetence(agentId, competenceId);
      else await grantCompetence(agentId, competenceId);
      load();
    } catch (err) {
      console.error(err);
      setError('Impossible de mettre à jour cette compétence. Vérifie que ton compte est admin ou superadmin.');
    }
  }

  function startEdit(agent: Agent) {
    setEditing(agent.id);
    setEditNom(agent.nom);
    setEditPrenom(agent.prenom);
  }

  async function handleSaveIdentity(agentId: string) {
    setError(null);
    try {
      await updateAgentIdentity(agentId, { nom: editNom.trim(), prenom: editPrenom.trim() });
      setEditing(null);
      load();
      showToast('Fiche mise à jour.');
    } catch (err) {
      console.error(err);
      setError("Impossible d'enregistrer ces informations.");
    }
  }

  async function handleToggleActif(agent: Agent) {
    if (agent.actif && !confirmAction(`Désactiver ${agent.prenom} ${agent.nom} ?`)) return;
    setError(null);
    try {
      await setAgentActif(agent.id, !agent.actif);
      load();
      showToast(agent.actif ? 'Agent désactivé.' : 'Agent réactivé.');
    } catch (err) {
      console.error(err);
      setError("Impossible de changer l'état actif de cet agent.");
    }
  }

  async function handleChangeNiveau(agentId: string, niveau: NiveauAcces) {
    setError(null);
    try {
      await updateNiveauAcces(agentId, niveau);
      load();
      showToast("Niveau d'accès modifié.");
    } catch (err) {
      console.error(err);
      setError("Impossible de changer le niveau d'accès (réservé au superadmin).");
    }
  }

  async function handleChangeGrade(agentId: string, gradeId: string) {
    setError(null);
    try {
      await updateAgentGrade(agentId, gradeId || null);
      load();
      showToast('Grade modifié.');
    } catch (err) {
      console.error(err);
      setError('Impossible de changer le grade (réservé admin/superadmin).');
    }
  }

  const toneFor = (n: Agent['niveau_acces']) => (n === 'superadmin' ? 'red' : n === 'admin' ? 'amber' : 'neutral');

  if (loading) return <Spinner />;

  return (
    <div className="stack">
      <PageHeader
        title="Agents"
        sub={
          moi?.niveau_acces === 'superadmin'
            ? "Modifie les fiches, attribue les compétences, gère les accès."
            : "Tu vois les agents de tes gardes. Modifie leurs fiches et leurs compétences."
        }
      />
      {error && <ErrorBanner message={error} />}

      <div className="input-search-wrap">
        <IconSearch className="input-search-icon" />
        <input
          className="input"
          placeholder="Rechercher un agent (nom, prénom, email)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="stack-sm">
        {filteredAgents.map((agent) => (
          <Card key={agent.id} className={agent.actif ? '' : 'agent-inactif'}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                {editing === agent.id ? (
                  <div className="field-row">
                    <input className="input" style={{ maxWidth: 130 }} value={editPrenom} onChange={(e) => setEditPrenom(e.target.value)} placeholder="Prénom" />
                    <input className="input" style={{ maxWidth: 130 }} value={editNom} onChange={(e) => setEditNom(e.target.value)} placeholder="Nom" />
                    <Button onClick={() => handleSaveIdentity(agent.id)}>Enregistrer</Button>
                    <Button variant="secondary" onClick={() => setEditing(null)}>Annuler</Button>
                  </div>
                ) : (
                  <>
                    <strong><AgentLink agentId={agent.id}>{agent.prenom} {agent.nom}</AgentLink></strong>{' '}
                    <button className="link-edit" onClick={() => startEdit(agent)}>modifier</button>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }} className="mono">{agent.email}</div>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <select
                  className="input"
                  style={{ fontSize: 12 }}
                  value={agent.grade_id ?? ''}
                  onChange={(e) => handleChangeGrade(agent.id, e.target.value)}
                >
                  <option value="">Aucun grade</option>
                  {grades.map((g) => (
                    <option key={g.id} value={g.id}>{g.nom}</option>
                  ))}
                </select>
                {moi?.niveau_acces === 'superadmin' ? (
                  <select
                    className="input"
                    style={{ fontSize: 12 }}
                    value={agent.niveau_acces}
                    onChange={(e) => handleChangeNiveau(agent.id, e.target.value as NiveauAcces)}
                  >
                    {NIVEAUX.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                ) : (
                  <Badge tone={toneFor(agent.niveau_acces)}>{agent.niveau_acces}</Badge>
                )}
                <Button variant="secondary" onClick={() => handleToggleActif(agent)}>
                  {agent.actif ? 'Désactiver' : 'Réactiver'}
                </Button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {competences.map((c) => {
                const hasIt = agentCompetences.some((ac) => ac.agent_id === agent.id && ac.competence_id === c.id);
                return (
                  <label key={c.id} className="checkbox-pill">
                    <input type="checkbox" checked={hasIt} onChange={() => handleToggleCompetence(agent.id, c.id, hasIt)} />
                    {c.nom}
                  </label>
                );
              })}
              {competences.length === 0 && <EmptyState>Aucune compétence définie — crée-en depuis Référentiels.</EmptyState>}
            </div>
          </Card>
        ))}
        {filteredAgents.length === 0 && (
          <EmptyState>{search.trim() ? 'Aucun agent ne correspond à cette recherche.' : 'Aucun agent enregistré.'}</EmptyState>
        )}
      </div>
    </div>
  );
}
