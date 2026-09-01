import { useEffect, useMemo, useState } from 'react';
import { fetchAgents } from '../api/agents';
import { fetchVehicules, fetchAllPostes } from '../api/vehicules';
import { fetchAffectationsForRange } from '../api/affectations';
import { fetchDisponibilitesForRange } from '../api/disponibilites';
import { fetchAllAgentGardes } from '../api/gardes';
import type { AgentGardeLink } from '../api/gardes';
import type { Agent, Vehicule, PosteVehicule, Affectation, Disponibilite } from '../lib/types';
import { scopeAgentsToMyGardes } from '../lib/scope';
import { buildPosteVehiculeLookup } from '../lib/format';
import { todayIso, daysAgo } from '../lib/dates';
import { AgentLink } from '../components/ui/AgentLink';
import { useAuth } from '../hooks/useAuth';
import { Card, ErrorBanner, Spinner, PageHeader, Field, EmptyState, Badge } from '../components/ui/Primitives';

const PERIODES = [
  { label: '7 derniers jours', jours: 7 },
  { label: '30 derniers jours', jours: 30 },
  { label: '90 derniers jours', jours: 90 },
];

export function StatistiquesPage() {
  const { agent: moi } = useAuth();
  const [periodeJours, setPeriodeJours] = useState(30);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentGardes, setAgentGardes] = useState<AgentGardeLink[]>([]);
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [postes, setPostes] = useState<PosteVehicule[]>([]);
  const [affectations, setAffectations] = useState<Affectation[]>([]);
  const [dispos, setDispos] = useState<Disponibilite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const from = daysAgo(periodeJours);
    const to = todayIso();
    Promise.all([
      fetchAgents(),
      fetchVehicules(),
      fetchAllPostes(),
      fetchAffectationsForRange(from, to),
      fetchDisponibilitesForRange(from, to),
      fetchAllAgentGardes(),
    ])
      .then(([a, v, p, aff, d, ag]) => {
        setAgents(a.filter((agent) => agent.actif));
        setVehicules(v);
        setPostes(p);
        setAffectations(aff);
        setDispos(d);
        setAgentGardes(ag);
      })
      .catch(() => setError('Impossible de charger les statistiques.'))
      .finally(() => setLoading(false));
  }, [periodeJours]);

  const visibleAgents = useMemo(
    () => scopeAgentsToMyGardes(agents, agentGardes, moi),
    [agents, agentGardes, moi]
  );

  const { vehiculeNomForPoste } = useMemo(
    () => buildPosteVehiculeLookup(postes, vehicules),
    [postes, vehicules]
  );

  const stats = useMemo(() => {
    return visibleAgents
      .map((agent) => {
        const mesAffectations = affectations.filter((a) => a.agent_id === agent.id);
        const mesDispos = dispos.filter((d) => d.agent_id === agent.id);

        const parVehicule = new Map<string, number>();
        for (const a of mesAffectations) {
          const nom = vehiculeNomForPoste(a.poste_vehicule_id);
          parVehicule.set(nom, (parVehicule.get(nom) ?? 0) + 1);
        }

        const derniereDate = mesAffectations.length > 0
          ? mesAffectations.map((a) => a.date).sort().slice(-1)[0]
          : null;

        return {
          agent,
          nbGardes: mesAffectations.length,
          nbDispos: mesDispos.length,
          derniereDate,
          parVehicule: Array.from(parVehicule.entries()).sort((a, b) => b[1] - a[1]),
        };
      })
      // Les moins sollicités en premier : ce sont les candidats naturels
      // pour la prochaine affectation, dans un souci d'équité.
      .sort((a, b) => a.nbGardes - b.nbGardes);
  }, [visibleAgents, affectations, dispos, vehiculeNomForPoste]);

  const maxGardes = Math.max(1, ...stats.map((s) => s.nbGardes));
  const totalGardes = stats.reduce((sum, s) => sum + s.nbGardes, 0);
  const moyenne = visibleAgents.length > 0 ? (totalGardes / visibleAgents.length).toFixed(1) : '0';

  if (loading) return <Spinner />;

  return (
    <div className="stack">
      <PageHeader
        title="Statistiques"
        sub={
          moi?.niveau_acces === 'superadmin'
            ? "Les agents les moins sollicités récemment apparaissent en premier — pour affecter plus équitablement."
            : "Statistiques des agents de tes gardes, les moins sollicités en premier."
        }
      />
      {error && <ErrorBanner message={error} />}

      <Card>
        <Field label="Période" style={{ maxWidth: 220 }}>
          <select className="input" value={periodeJours} onChange={(e) => setPeriodeJours(Number(e.target.value))}>
            {PERIODES.map((p) => (
              <option key={p.jours} value={p.jours}>{p.label}</option>
            ))}
          </select>
        </Field>
        <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 10 }}>
          {totalGardes} garde{totalGardes !== 1 ? 's' : ''} au total sur la période · en moyenne{' '}
          <strong style={{ color: 'var(--text-2)' }}>{moyenne}</strong> par agent
        </p>
      </Card>

      <Card>
        {stats.length === 0 && <EmptyState>Aucun agent actif à afficher.</EmptyState>}
        {stats.map(({ agent, nbGardes, nbDispos, derniereDate, parVehicule }) => (
          <div key={agent.id} className="stat-row">
            <div className="stat-row-head">
              <span className="stat-agent-name"><AgentLink agentId={agent.id}>{agent.prenom} {agent.nom}</AgentLink></span>
              <span className="stat-count">
                <strong>{nbGardes}</strong> garde{nbGardes !== 1 ? 's' : ''}
                {nbDispos > 0 && <> · {nbDispos} dispo{nbDispos !== 1 ? 's' : ''} déclarée{nbDispos !== 1 ? 's' : ''}</>}
              </span>
            </div>
            <div className="stat-bar-track">
              <div className="stat-bar-fill" style={{ width: `${(nbGardes / maxGardes) * 100}%` }} />
            </div>
            <div className="stat-meta">
              <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                Dernière garde : {derniereDate ? <time className="mono">{derniereDate}</time> : 'aucune sur la période'}
              </span>
              {parVehicule.map(([nom, count]) => (
                <Badge key={nom}>{nom} <span className="mono">×{count}</span></Badge>
              ))}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
