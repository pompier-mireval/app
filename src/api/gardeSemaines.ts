import { supabase } from '../lib/supabaseClient';
import type { GardeSemaine } from '../lib/types';

export async function fetchGardeSemaine(semaineDebut: string): Promise<GardeSemaine | null> {
  const { data, error } = await supabase
    .from('garde_semaines')
    .select('*')
    .eq('semaine_debut', semaineDebut)
    .maybeSingle();
  if (error) throw error;
  return data as GardeSemaine | null;
}

// Réservé admin/superadmin (policy RLS)
export async function setGardeSemaine(semaineDebut: string, gardeId: string): Promise<void> {
  const { error } = await supabase
    .from('garde_semaines')
    .upsert({ semaine_debut: semaineDebut, garde_id: gardeId }, { onConflict: 'semaine_debut' });
  if (error) throw error;
}

export async function clearGardeSemaine(semaineDebut: string): Promise<void> {
  const { error } = await supabase.from('garde_semaines').delete().eq('semaine_debut', semaineDebut);
  if (error) throw error;
}
