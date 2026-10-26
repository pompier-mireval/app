import { supabase } from '../lib/supabaseClient';
import { cached } from '../lib/cache';
import type { Vehicule, PosteVehicule } from '../lib/types';

export function fetchVehicules(): Promise<Vehicule[]> {
  return cached('vehicules', async () => {
    const { data, error } = await supabase.from('vehicules').select('*').order('ordre').order('nom');
    if (error) throw error;
    return data as Vehicule[];
  });
}

// Tous les postes, tous véhicules confondus — utile pour construire la
// grille de planning sans faire une requête par véhicule.
export function fetchAllPostes(): Promise<PosteVehicule[]> {
  return cached('postes', async () => {
    const { data, error } = await supabase.from('postes_vehicule').select('*').order('ordre');
    if (error) throw error;
    return data as PosteVehicule[];
  });
}

export interface PosteCompetenceLink {
  poste_id: string;
  competence_id: string;
}

export function fetchAllPostesCompetences(): Promise<PosteCompetenceLink[]> {
  return cached('postes_competences', async () => {
    const { data, error } = await supabase.from('postes_competences').select('*');
    if (error) throw error;
    return data as PosteCompetenceLink[];
  });
}

// Réservé superadmin (policy RLS)
export async function createVehicule(input: Pick<Vehicule, 'nom' | 'immatriculation' | 'type'>): Promise<Vehicule> {
  const { data: dernier } = await supabase.from('vehicules').select('ordre, ordre_generation').order('ordre', { ascending: false }).limit(1).maybeSingle();
  const { data: dernierGen } = await supabase.from('vehicules').select('ordre_generation').order('ordre_generation', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from('vehicules')
    .insert({ ...input, ordre: (dernier?.ordre ?? 0) + 1, ordre_generation: (dernierGen?.ordre_generation ?? 0) + 1 })
    .select()
    .single();
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

// Réservé superadmin (policy RLS) : inclut ou exclut le véhicule du planning.
export async function setVehiculeDansPlanning(id: string, dansPlanning: boolean): Promise<void> {
  const { error } = await supabase.from('vehicules').update({ dans_planning: dansPlanning }).eq('id', id);
  if (error) throw error;
}

// Réservé superadmin (policy RLS) : propose ou retire le véhicule des prêts.
export async function setVehiculePretable(id: string, pretable: boolean): Promise<void> {
  const { error } = await supabase.from('vehicules').update({ pretable }).eq('id', id);
  if (error) throw error;
}

// Réservé superadmin : réécrit l'ordre de tous les véhicules selon la liste fournie.
export async function saveVehiculesOrder(idsInOrder: string[]): Promise<void> {
  const results = await Promise.all(idsInOrder.map((id, i) => supabase.from('vehicules').update({ ordre: i + 1 }).eq('id', id)));
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

// Réservé superadmin : ordre de remplissage de la génération automatique.
export async function saveVehiculesGenerationOrder(idsInOrder: string[]): Promise<void> {
  const results = await Promise.all(idsInOrder.map((id, i) => supabase.from('vehicules').update({ ordre_generation: i + 1 }).eq('id', id)));
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
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
