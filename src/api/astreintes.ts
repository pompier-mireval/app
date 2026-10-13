import { supabase } from '../lib/supabaseClient';
import type { Astreinte, AstreinteConfig } from '../lib/types';

export async function fetchAstreintesForRange(from: string, to: string): Promise<Astreinte[]> {
  const { data, error } = await supabase
    .from('astreintes')
    .select('*')
    .gte('date', from)
    .lte('date', to);
  if (error) throw error;
  return data as Astreinte[];
}

// Réservé admin/superadmin (policy RLS). Le doublon (agent, date) est
// ignoré : relancer une génération ne casse pas l'existant.
export async function createAstreintes(rows: { agentId: string; date: string }[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from('astreintes')
    .upsert(rows.map((r) => ({ agent_id: r.agentId, date: r.date })), { onConflict: 'agent_id,date', ignoreDuplicates: true });
  if (error) throw error;
}

export async function deleteAstreinte(id: string): Promise<void> {
  const { error } = await supabase.from('astreintes').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteAstreintesForRange(from: string, to: string): Promise<void> {
  const { error } = await supabase.from('astreintes').delete().gte('date', from).lte('date', to);
  if (error) throw error;
}

export async function fetchAstreinteConfig(): Promise<AstreinteConfig | null> {
  const { data, error } = await supabase.from('astreinte_config').select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  return data as AstreinteConfig | null;
}

export async function saveAstreinteConfig(config: Omit<AstreinteConfig, 'id'>): Promise<void> {
  const { error } = await supabase.from('astreinte_config').upsert({ id: 1, ...config });
  if (error) throw error;
}
