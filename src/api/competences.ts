import { supabase } from '../lib/supabaseClient';
import type { Competence, AgentCompetence } from '../lib/types';

export async function fetchCompetences(): Promise<Competence[]> {
  const { data, error } = await supabase.from('competences').select('*').order('nom');
  if (error) throw error;
  return data as Competence[];
}

export async function fetchAgentCompetences(agentId: string): Promise<AgentCompetence[]> {
  const { data, error } = await supabase
    .from('agent_competences')
    .select('*')
    .eq('agent_id', agentId);
  if (error) throw error;
  return data as AgentCompetence[];
}

// Toutes les compétences de tous les agents — utile pour la grille de
// planning (savoir qui est éligible à quel poste sans requête par agent).
export async function fetchAllAgentCompetences(): Promise<AgentCompetence[]> {
  const { data, error } = await supabase.from('agent_competences').select('*');
  if (error) throw error;
  return data as AgentCompetence[];
}

// Réservé admin/superadmin (policy RLS)
export async function grantCompetence(agentId: string, competenceId: string): Promise<void> {
  const { error } = await supabase
    .from('agent_competences')
    .upsert({ agent_id: agentId, competence_id: competenceId });
  if (error) throw error;
}

// Réservé admin/superadmin (policy RLS)
export async function revokeCompetence(agentId: string, competenceId: string): Promise<void> {
  const { error } = await supabase
    .from('agent_competences')
    .delete()
    .eq('agent_id', agentId)
    .eq('competence_id', competenceId);
  if (error) throw error;
}

// Réservé superadmin (policy RLS) — gestion du référentiel
export async function createCompetence(code: string, nom: string): Promise<void> {
  const { error } = await supabase.from('competences').insert({ code, nom });
  if (error) throw error;
}

export async function updateCompetence(id: string, code: string, nom: string): Promise<void> {
  const { error } = await supabase.from('competences').update({ code, nom }).eq('id', id);
  if (error) throw error;
}

// La suppression échouera si la compétence est référencée par un poste ou
// un agent (contrainte de clé étrangère) — c'est voulu, ça évite de casser
// des données existantes par erreur.
export async function deleteCompetence(id: string): Promise<void> {
  const { error } = await supabase.from('competences').delete().eq('id', id);
  if (error) throw error;
}
