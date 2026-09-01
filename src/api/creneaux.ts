import { supabase } from '../lib/supabaseClient';
import type { CreneauType } from '../lib/types';

export async function fetchCreneauxTypes(): Promise<CreneauType[]> {
  const { data, error } = await supabase.from('creneaux_types').select('*').order('heure_debut');
  if (error) throw error;
  return data as CreneauType[];
}

// Réservé superadmin (policy RLS)
export async function createCreneauType(nom: string, heureDebut: string, heureFin: string): Promise<void> {
  const { error } = await supabase
    .from('creneaux_types')
    .insert({ nom, heure_debut: heureDebut, heure_fin: heureFin });
  if (error) throw error;
}

export async function updateCreneauType(id: string, nom: string, heureDebut: string, heureFin: string): Promise<void> {
  const { error } = await supabase
    .from('creneaux_types')
    .update({ nom, heure_debut: heureDebut, heure_fin: heureFin })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteCreneauType(id: string): Promise<void> {
  const { error } = await supabase.from('creneaux_types').delete().eq('id', id);
  if (error) throw error;
}
