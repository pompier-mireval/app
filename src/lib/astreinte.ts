import type { AgentCompetence, AstreinteConfig } from './types';

export type CategorieAstreinte = 'ca' | 'conducteur' | 'equipier';

export const CATEGORIES: { key: CategorieAstreinte; label: string }[] = [
  { key: 'ca', label: 'CA VSAV' },
  { key: 'conducteur', label: 'Conducteur' },
  { key: 'equipier', label: 'Équipier VSAV' },
];

export const NB_MAX_DEFAUT = 7;

export interface CompetencesAstreinte {
  ca: string | null;
  conducteur: string | null;
  equipier: string | null;
}

// Compétences retenues pour chaque catégorie : uniquement celles choisies
// dans les réglages (aucune détection automatique).
export function resolveCompetences(config: AstreinteConfig | null): CompetencesAstreinte {
  return {
    ca: config?.competence_ca_id ?? null,
    conducteur: config?.competence_conducteur_id ?? null,
    equipier: config?.competence_equipier_id ?? null,
  };
}

// Règle stricte : la plus haute compétence gagne (CA > conducteur >
// équipier). Un agent sans aucune des trois n'est pas astreignable.
export function categorieOf(
  agentId: string,
  agentCompetences: AgentCompetence[],
  comps: CompetencesAstreinte
): CategorieAstreinte | null {
  const has = (id: string | null) => !!id && agentCompetences.some((ac) => ac.agent_id === agentId && ac.competence_id === id);
  if (has(comps.ca)) return 'ca';
  if (has(comps.conducteur)) return 'conducteur';
  if (has(comps.equipier)) return 'equipier';
  return null;
}

export interface Candidat {
  agentId: string;
  categorie: CategorieAstreinte;
  label: string; // tie-break stable
}

// Choisit les astreints d'une journée : d'abord un de chaque catégorie
// (le moins chargé), puis on complète jusqu'à `nbMax` en prenant à chaque
// fois le moins chargé restant. `charge` est mis à jour pour que les jours
// suivants de la génération restent équilibrés.
export function pickAstreintes(
  candidats: Candidat[],
  dejaChoisis: Set<string>,
  nbMax: number,
  charge: Map<string, number>
): string[] {
  const chosen = new Set(dejaChoisis);
  const picked: string[] = [];
  const byCharge = (a: Candidat, b: Candidat) =>
    (charge.get(a.agentId) ?? 0) - (charge.get(b.agentId) ?? 0) || a.label.localeCompare(b.label);
  const take = (c: Candidat) => {
    chosen.add(c.agentId);
    picked.push(c.agentId);
    charge.set(c.agentId, (charge.get(c.agentId) ?? 0) + 1);
  };

  for (const { key } of CATEGORIES) {
    if (chosen.size >= nbMax) break;
    if (candidats.some((c) => c.categorie === key && chosen.has(c.agentId))) continue;
    const best = candidats.filter((c) => c.categorie === key && !chosen.has(c.agentId)).sort(byCharge)[0];
    if (best) take(best);
  }
  while (chosen.size < nbMax) {
    const best = candidats.filter((c) => !chosen.has(c.agentId)).sort(byCharge)[0];
    if (!best) break;
    take(best);
  }
  return picked;
}
