import { supabase } from '../lib/supabaseClient';
import type { Vehicule, PosteVehicule } from '../lib/types';

export async function fetchVehicules(): Promise<Vehicule[]> {
  const { data, error } = await supabase.from('vehicules').select('*').order('nom');
  if (error) throw error;
  return data as Vehicule[];
}

export async function fetchPostesForVehicule(vehiculeId: string): Promise<PosteVehicule[]> {
  const { data, error } = await supabase
    .from('postes_vehicule')
    .select('*')
    .eq('vehicule_id', vehiculeId)
    .order('ordre');
  if (error) throw error;
  return data as PosteVehicule[];
}

// Tous les postes, tous véhicules confondus — utile pour construire la
// grille de planning sans faire une requête par véhicule.
export async function fetchAllPostes(): Promise<PosteVehicule[]> {
  const { data, error } = await supabase.from('postes_vehicule').select('*').order('ordre');
  if (error) throw error;
  return data as PosteVehicule[];
}

export interface PosteCompetenceLink {
  poste_id: string;
  competence_id: string;
}

export async function fetchAllPostesCompetences(): Promise<PosteCompetenceLink[]> {
  const { data, error } = await supabase.from('postes_competences').select('*');
  if (error) throw error;
  return data as PosteCompetenceLink[];
}

// Réservé superadmin (policy RLS)
export async function createVehicule(input: Pick<Vehicule, 'nom' | 'immatriculation' | 'type'>): Promise<Vehicule> {
  const { data, error } = await supabase.from('vehicules').insert(input).select().single();
  if (error) throw error;
  return data as Vehicule;
}

export async function updateVehicule(
  id: string,
  input: Pick<Vehicule, 'nom' | 'immatriculation' | 'type' | 'statut'>
): Promise<void> {
  const { error } = await supabase.from('vehicules').update(input).eq('id', id);
  if (error) throw error;
}

// Supprime le véhicule et, en cascade (définie en base), ses postes et
// leurs liaisons de compétences.
export async function deleteVehicule(id: string): Promise<void> {
  const { error } = await supabase.from('vehicules').delete().eq('id', id);
  if (error) throw error;
}

export async function deletePoste(posteId: string): Promise<void> {
  const { error } = await supabase.from('postes_vehicule').delete().eq('id', posteId);
  if (error) throw error;
}

export async function updatePosteNom(posteId: string, nomPoste: string): Promise<void> {
  const { error } = await supabase.from('postes_vehicule').update({ nom_poste: nomPoste }).eq('id', posteId);
  if (error) throw error;
}

export async function addPosteCompetence(posteId: string, competenceId: string): Promise<void> {
  const { error } = await supabase.from('postes_competences').insert({ poste_id: posteId, competence_id: competenceId });
  if (error) throw error;
}

export async function removePosteCompetence(posteId: string, competenceId: string): Promise<void> {
  const { error } = await supabase
    .from('postes_competences')
    .delete()
    .eq('poste_id', posteId)
    .eq('competence_id', competenceId);
  if (error) throw error;
}

// Réservé superadmin (policy RLS)
export async function addPosteToVehicule(
  vehiculeId: string,
  nomPoste: string,
  ordre: number,
  competenceIds: string[]
): Promise<void> {
  const { data: poste, error } = await supabase
    .from('postes_vehicule')
    .insert({ vehicule_id: vehiculeId, nom_poste: nomPoste, ordre })
    .select()
    .single();
  if (error) throw error;

  if (competenceIds.length > 0) {
    const rows = competenceIds.map((competence_id) => ({ poste_id: poste.id, competence_id }));
    const { error: linkError } = await supabase.from('postes_competences').insert(rows);
    if (linkError) throw linkError;
  }
}
