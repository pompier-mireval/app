import { supabase } from '../lib/supabaseClient';
import type { SignalementBatiment } from '../lib/types';

export async function fetchSignalements(): Promise<SignalementBatiment[]> {
  const { data, error } = await supabase
    .from('signalements_batiment')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data as SignalementBatiment[];
}

export async function createSignalement(input: {
  lieu: string;
  agentId: string;
  description: string;
  urgence: 'normale' | 'urgente';
}): Promise<void> {
  const { error } = await supabase.from('signalements_batiment').insert({
    lieu: input.lieu,
    agent_id: input.agentId,
    description: input.description,
    urgence: input.urgence,
  });
  if (error) throw error;
}

// Réservé responsables/superadmin (policy RLS)
export async function setSignalementStatut(id: string, statut: 'ouvert' | 'resolu'): Promise<void> {
  const { error } = await supabase
    .from('signalements_batiment')
    .update({ statut, resolu_at: statut === 'resolu' ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteSignalement(id: string): Promise<void> {
  const { error } = await supabase.from('signalements_batiment').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchResponsablesBatiment(): Promise<string[]> {
  const { data, error } = await supabase.from('responsables_batiment').select('agent_id');
  if (error) throw error;
  return (data ?? []).map((r: { agent_id: string }) => r.agent_id);
}

// Réservé superadmin (policy RLS)
export async function addResponsableBatiment(agentId: string): Promise<void> {
  const { error } = await supabase.from('responsables_batiment').insert({ agent_id: agentId });
  if (error) throw error;
}

export async function removeResponsableBatiment(agentId: string): Promise<void> {
  const { error } = await supabase.from('responsables_batiment').delete().eq('agent_id', agentId);
  if (error) throw error;
}
