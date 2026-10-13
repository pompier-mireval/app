import { supabase } from '../lib/supabaseClient';
import type { PetitMateriel, FamilleControle, InventaireControle, InventaireItem, InventaireManque } from '../lib/types';

// Colonne qui porte le sujet du contrôle : un véhicule, ou un petit matériel.
const col = (famille: FamilleControle) => (famille === 'materiel' ? 'materiel_id' : 'vehicule_id');

export async function fetchItems(vehiculeId: string, famille: FamilleControle): Promise<InventaireItem[]> {
  const { data, error } = await supabase
    .from('inventaire_items')
    .select('*')
    .eq(col(famille), vehiculeId)
    .eq('famille', famille)
    .order('zone')
    .order('ordre')
    .order('nom');
  if (error) throw error;
  return data as InventaireItem[];
}

// Réservé superadmin (policy RLS)
export async function createItem(input: { famille: FamilleControle; vehiculeId: string; zone: string; nom: string; quantite: number; ordre: number }): Promise<void> {
  const { error } = await supabase.from('inventaire_items').insert({
    famille: input.famille,
    [col(input.famille)]: input.vehiculeId,
    zone: input.zone,
    nom: input.nom,
    quantite: input.quantite,
    ordre: input.ordre,
  });
  if (error) throw error;
}

export async function updateItem(id: string, input: { zone: string; nom: string; quantite: number }): Promise<void> {
  const { error } = await supabase.from('inventaire_items').update(input).eq('id', id);
  if (error) throw error;
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('inventaire_items').delete().eq('id', id);
  if (error) throw error;
}

export interface ProblemeInput {
  item: InventaireItem;
  probleme: 'manquant' | 'defectueux' | 'anomalie';
  quantiteConstatee: number;
  commentaire: string | null;
}

export async function createControle(input: {
  famille: FamilleControle;
  vehiculeId: string;
  agentId: string;
  nbItems: number;
  problemes: ProblemeInput[];
}): Promise<void> {
  const { data, error } = await supabase
    .from('inventaire_controles')
    .insert({ famille: input.famille, [col(input.famille)]: input.vehiculeId, agent_id: input.agentId, nb_items: input.nbItems })
    .select('id')
    .single();
  if (error) throw error;
  if (input.problemes.length === 0) return;
  const { error: mErr } = await supabase.from('inventaire_manques').insert(
    input.problemes.map((p) => ({
      famille: input.famille,
      controle_id: data.id,
      [col(input.famille)]: input.vehiculeId,
      agent_id: input.agentId,
      item_id: p.item.id,
      zone: p.item.zone,
      item_nom: p.item.nom,
      quantite_attendue: p.item.quantite,
      quantite_constatee: p.probleme === 'manquant' ? p.quantiteConstatee : 0,
      probleme: p.probleme,
      commentaire: p.commentaire,
    })),
  );
  if (mErr) {
    await supabase.from('inventaire_controles').delete().eq('id', data.id); // refusé si pas superadmin : sans gravité
    throw mErr;
  }
}

export async function fetchControles(famille: FamilleControle): Promise<InventaireControle[]> {
  const { data, error } = await supabase.from('inventaire_controles').select('*').eq('famille', famille).order('created_at', { ascending: false }).limit(300);
  if (error) throw error;
  return data as InventaireControle[];
}

// Admin+ : tous les manquants. Un simple agent ne reçoit que les siens (RLS).
export async function fetchManques(famille: FamilleControle): Promise<InventaireManque[]> {
  const { data, error } = await supabase.from('inventaire_manques').select('*').eq('famille', famille).order('created_at', { ascending: false }).limit(300);
  if (error) throw error;
  return data as InventaireManque[];
}

// Réservé admin+ (policy RLS)
export async function setManqueStatut(id: string, statut: 'a_traiter' | 'regle'): Promise<void> {
  const { error } = await supabase
    .from('inventaire_manques')
    .update({ statut, regle_at: statut === 'regle' ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

export async function fetchMateriels(): Promise<PetitMateriel[]> {
  const { data, error } = await supabase.from('petit_materiel').select('*').order('nom');
  if (error) throw error;
  return data as PetitMateriel[];
}

// Réservé superadmin (policy RLS)
export async function createMateriel(nom: string): Promise<void> {
  const { error } = await supabase.from('petit_materiel').insert({ nom });
  if (error) throw error;
}

export async function deleteMateriel(id: string): Promise<void> {
  const { error } = await supabase.from('petit_materiel').delete().eq('id', id);
  if (error) throw error;
}
