import { supabase } from '../lib/supabaseClient';
import type { DemandeHabillement, StatutDemandeHabillement, TypeVetement } from '../lib/types';

// La RLS ne renvoie que les demandes de l'agent connecté, ou toutes si
// c'est un référent habillement.
export async function fetchDemandes(): Promise<DemandeHabillement[]> {
  const { data, error } = await supabase
    .from('demandes_habillement')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data as DemandeHabillement[];
}

export async function createDemande(input: {
  agentId: string;
  type: TypeVetement;
  typeAutre: string | null;
  code: string | null;
  motif: string;
}): Promise<void> {
  const { error } = await supabase.from('demandes_habillement').insert({
    agent_id: input.agentId,
    type: input.type,
    type_autre: input.type === 'autre' ? input.typeAutre : null,
    code: input.code,
    motif: input.motif,
  });
  if (error) throw error;
}

// Réservé référents habillement (policy RLS)
export async function setDemandeStatut(id: string, statut: StatutDemandeHabillement): Promise<void> {
  const { error } = await supabase
    .from('demandes_habillement')
    .update({ statut, traite_at: statut === 'en_attente' ? null : new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteDemande(id: string): Promise<void> {
  const { error } = await supabase.from('demandes_habillement').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchResponsablesHabillement(): Promise<string[]> {
  const { data, error } = await supabase.from('responsables_habillement').select('agent_id');
  if (error) throw error;
  return (data ?? []).map((r: { agent_id: string }) => r.agent_id);
}

// Réservé superadmin (policy RLS)
export async function addResponsableHabillement(agentId: string): Promise<void> {
  const { error } = await supabase.from('responsables_habillement').insert({ agent_id: agentId });
  if (error) throw error;
}

export async function removeResponsableHabillement(agentId: string): Promise<void> {
  const { error } = await supabase.from('responsables_habillement').delete().eq('agent_id', agentId);
  if (error) throw error;
}
