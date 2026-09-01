import type { Agent } from './types';
import type { AgentGardeLink } from '../api/gardes';

// Un admin (pas superadmin) ne voit, sur les pages Agents et Statistiques,
// que les agents qui partagent au moins une garde avec lui. Le superadmin
// voit tout le monde, puisqu'il gère la structure dans son ensemble.
//
// Important : c'est un filtre d'AFFICHAGE uniquement. Les policies RLS
// autorisent toujours un admin à lire/modifier n'importe quel agent — ce
// filtre ne remplace pas un vrai contrôle d'accès si ce cloisonnement doit
// un jour devenir une règle de sécurité stricte (il faudrait alors une
// policy RLS équivalente côté base).
export function scopeAgentsToMyGardes(
  agents: Agent[],
  agentGardeLinks: AgentGardeLink[],
  moi: Agent | null
): Agent[] {
  if (!moi || moi.niveau_acces === 'superadmin') return agents;

  const mesGardeIds = new Set(
    agentGardeLinks.filter((l) => l.agent_id === moi.id).map((l) => l.garde_id)
  );

  if (mesGardeIds.size === 0) {
    // Pas encore affecté à une garde : on se voit soi-même plutôt qu'un
    // écran vide et sans explication.
    return agents.filter((a) => a.id === moi.id);
  }

  const agentIdsPartages = new Set(
    agentGardeLinks.filter((l) => mesGardeIds.has(l.garde_id)).map((l) => l.agent_id)
  );

  return agents.filter((a) => agentIdsPartages.has(a.id) || a.id === moi.id);
}
