import { supabase } from '../lib/supabaseClient';
import type { SignalementMecanique } from '../lib/types';

export async function fetchSignalements(): Promise<SignalementMecanique[]> {
  const { data, error } = await supabase
    .from('signalements_mecanique')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data as SignalementMecanique[];
}

export async function createSignalement(input: {
  vehiculeId: string;
  agentId: string;
  description: string;
  urgence: 'normale' | 'urgente';
}): Promise<void> {
  const { error } = await supabase.from('signalements_mecanique').insert({
    vehicule_id: input.vehiculeId,
    agent_id: input.agentId,
    description: input.description,
    urgence: input.urgence,
  });
  if (error) throw error;
}

// Réservé responsables/superadmin (policy RLS)
export async function setSignalementStatut(id: string, statut: 'ouvert' | 'resolu'): Promise<void> {
  const { error } = await supabase
    .from('signalements_mecanique')
    .update({ statut, resolu_at: statut === 'resolu' ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteSignalement(id: string): Promise<void> {
  const { error } = await supabase.from('signalements_mecanique').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchResponsablesMecanique(): Promise<string[]> {
  const { data, error } = await supabase.from('responsables_mecanique').select('agent_id');
  if (error) throw error;
  return (data ?? []).map((r: { agent_id: string }) => r.agent_id);
}

// Réservé superadmin (policy RLS)
export async function addResponsableMecanique(agentId: string): Promise<void> {
  const { error } = await supabase.from('responsables_mecanique').insert({ agent_id: agentId });
  if (error) throw error;
}

export async function removeResponsableMecanique(agentId: string): Promise<void> {
  const { error } = await supabase.from('responsables_mecanique').delete().eq('agent_id', agentId);
  if (error) throw error;
}
