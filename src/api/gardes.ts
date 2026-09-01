import { supabase } from '../lib/supabaseClient';
import type { Garde } from '../lib/types';

export async function fetchGardes(): Promise<Garde[]> {
  const { data, error } = await supabase.from('gardes').select('*').order('nom');
  if (error) throw error;
  return data as Garde[];
}

export async function fetchGardesForAgent(agentId: string): Promise<Garde[]> {
  const { data, error } = await supabase
    .from('agent_gardes')
    .select('garde:gardes(*)')
    .eq('agent_id', agentId);
  if (error) throw error;
  return (data ?? []).map((row: any) => row.garde) as Garde[];
}

export interface AgentGardeLink {
  agent_id: string;
  garde_id: string;
}

// Toutes les appartenances agent ↔ garde, pour construire la matrice de
// composition en une seule requête plutôt qu'une par garde.
export async function fetchAllAgentGardes(): Promise<AgentGardeLink[]> {
  const { data, error } = await supabase.from('agent_gardes').select('*');
  if (error) throw error;
  return data as AgentGardeLink[];
}

// Réservé superadmin (policy RLS)
export async function createGarde(nom: string): Promise<void> {
  const { error } = await supabase.from('gardes').insert({ nom });
  if (error) throw error;
}

export async function updateGarde(id: string, nom: string): Promise<void> {
  const { error } = await supabase.from('gardes').update({ nom }).eq('id', id);
  if (error) throw error;
}

export async function deleteGarde(id: string): Promise<void> {
  const { error } = await supabase.from('gardes').delete().eq('id', id);
  if (error) throw error;
}

// Réservé superadmin (policy RLS)
export async function assignAgentToGarde(agentId: string, gardeId: string): Promise<void> {
  const { error } = await supabase.from('agent_gardes').insert({ agent_id: agentId, garde_id: gardeId });
  if (error) throw error;
}

// Réservé superadmin (policy RLS)
export async function removeAgentFromGarde(agentId: string, gardeId: string): Promise<void> {
  const { error } = await supabase
    .from('agent_gardes')
    .delete()
    .eq('agent_id', agentId)
    .eq('garde_id', gardeId);
  if (error) throw error;
}
