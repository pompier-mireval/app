import { supabase } from '../lib/supabaseClient';
import type { Disponibilite, StatutDispo } from '../lib/types';

export async function fetchDisponibilites(agentId: string, from: string, to: string): Promise<Disponibilite[]> {
  const { data, error } = await supabase
    .from('disponibilites')
    .select('*')
    .eq('agent_id', agentId)
    .gte('date', from)
    .lte('date', to)
    .order('date');
  if (error) throw error;
  return data as Disponibilite[];
}

// Toutes les disponibilités déclarées pour une date donnée, tous agents
// confondus — utilisé par la page Planning pour afficher qui est
// disponible et à quelles heures avant d'affecter quelqu'un.
export async function fetchDisponibilitesForDate(date: string): Promise<Disponibilite[]> {
  const { data, error } = await supabase.from('disponibilites').select('*').eq('date', date);
  if (error) throw error;
  return data as Disponibilite[];
}

// Toutes les disponibilités d'une période, tous agents confondus — utilisé
// par la page Statistiques pour comparer dispo déclarée et gardes réelles.
export async function fetchDisponibilitesForRange(from: string, to: string): Promise<Disponibilite[]> {
  const { data, error } = await supabase
    .from('disponibilites')
    .select('*')
    .gte('date', from)
    .lte('date', to);
  if (error) throw error;
  return data as Disponibilite[];
}

interface SetDisponibiliteInput {
  agentId: string;
  date: string;
  statut: StatutDispo;
  creneauTypeId?: string;
  heureDebutPerso?: string;
  heureFinPerso?: string;
}

// Un agent ne peut écrire que ses propres dispos (policy RLS) —
// un admin/superadmin peut le faire pour n'importe qui.
export async function setDisponibilite(input: SetDisponibiliteInput): Promise<void> {
  const { error } = await supabase.from('disponibilites').insert({
    agent_id: input.agentId,
    date: input.date,
    statut: input.statut,
    creneau_type_id: input.creneauTypeId ?? null,
    heure_debut_perso: input.heureDebutPerso ?? null,
    heure_fin_perso: input.heureFinPerso ?? null,
  });
  if (error) throw error;
}

export async function deleteDisponibilite(id: string): Promise<void> {
  const { error } = await supabase.from('disponibilites').delete().eq('id', id);
  if (error) throw error;
}
