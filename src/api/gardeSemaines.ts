import { supabase } from '../lib/supabaseClient';
import type { GardeSemaine, GardeSemaineType } from '../lib/types';

export async function fetchGardeSemaine(semaineDebut: string, type: GardeSemaineType): Promise<GardeSemaine | null> {
  const { data, error } = await supabase
    .from('garde_semaines')
    .select('*')
    .eq('semaine_debut', semaineDebut)
    .eq('type', type)
    .maybeSingle();
  if (error) throw error;
  return data as GardeSemaine | null;
}

// Un même bloc "semaine" peut porter à la fois une garde de jour et une
// garde de nuit — on les récupère en une requête plutôt que deux.
export async function fetchGardeSemainesForDate(semaineDebut: string): Promise<GardeSemaine[]> {
  const { data, error } = await supabase.from('garde_semaines').select('*').eq('semaine_debut', semaineDebut);
  if (error) throw error;
  return data as GardeSemaine[];
}

// Réservé admin/superadmin (policy RLS)
export async function setGardeSemaine(semaineDebut: string, type: GardeSemaineType, gardeId: string): Promise<void> {
  const { error } = await supabase
    .from('garde_semaines')
    .upsert({ semaine_debut: semaineDebut, type, garde_id: gardeId }, { onConflict: 'semaine_debut,type' });
  if (error) throw error;
}

export async function clearGardeSemaine(semaineDebut: string, type: GardeSemaineType): Promise<void> {
  const { error } = await supabase.from('garde_semaines').delete().eq('semaine_debut', semaineDebut).eq('type', type);
  if (error) throw error;
}
