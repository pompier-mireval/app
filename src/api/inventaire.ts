import { supabase } from '../lib/supabaseClient';
import type { InventaireControle, InventaireItem, InventaireManque } from '../lib/types';

export async function fetchItems(vehiculeId: string): Promise<InventaireItem[]> {
  const { data, error } = await supabase
    .from('inventaire_items')
    .select('*')
    .eq('vehicule_id', vehiculeId)
    .order('zone')
    .order('ordre')
    .order('nom');
  if (error) throw error;
  return data as InventaireItem[];
}

// Réservé superadmin (policy RLS)
export async function createItem(input: { vehiculeId: string; zone: string; nom: string; quantite: number; ordre: number }): Promise<void> {
  const { error } = await supabase.from('inventaire_items').insert({
    vehicule_id: input.vehiculeId,
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
  probleme: 'manquant' | 'defectueux';
  quantiteConstatee: number;
  commentaire: string | null;
}

export async function createControle(input: {
  vehiculeId: string;
  agentId: string;
  nbItems: number;
  problemes: ProblemeInput[];
}): Promise<void> {
  const { data, error } = await supabase
    .from('inventaire_controles')
    .insert({ vehicule_id: input.vehiculeId, agent_id: input.agentId, nb_items: input.nbItems })
    .select('id')
    .single();
  if (error) throw error;
  if (input.problemes.length === 0) return;
  const { error: mErr } = await supabase.from('inventaire_manques').insert(
    input.problemes.map((p) => ({
      controle_id: data.id,
      vehicule_id: input.vehiculeId,
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

export async function fetchControles(): Promise<InventaireControle[]> {
  const { data, error } = await supabase.from('inventaire_controles').select('*').order('created_at', { ascending: false }).limit(300);
  if (error) throw error;
  return data as InventaireControle[];
}

// Admin+ : tous les manquants. Un simple agent ne reçoit que les siens (RLS).
export async function fetchManques(): Promise<InventaireManque[]> {
  const { data, error } = await supabase.from('inventaire_manques').select('*').order('created_at', { ascending: false }).limit(300);
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
