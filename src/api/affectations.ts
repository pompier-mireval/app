import { supabase } from '../lib/supabaseClient';
import type { Affectation } from '../lib/types';

export async function fetchAffectationsForDate(date: string): Promise<Affectation[]> {
  const { data, error } = await supabase.from('affectations').select('*').eq('date', date);
  if (error) throw error;
  return data as Affectation[];
}

export async function fetchAffectationsForAgent(agentId: string, from: string, to: string): Promise<Affectation[]> {
  const { data, error } = await supabase
    .from('affectations')
    .select('*')
    .eq('agent_id', agentId)
    .gte('date', from)
    .lte('date', to)
    .order('date');
  if (error) throw error;
  return data as Affectation[];
}

// Toutes les affectations d'une période, tous agents confondus — utilisé
// par la page Statistiques pour calculer la charge de chacun.
export async function fetchAffectationsForRange(from: string, to: string): Promise<Affectation[]> {
  const { data, error } = await supabase
    .from('affectations')
    .select('*')
    .gte('date', from)
    .lte('date', to);
  if (error) throw error;
  return data as Affectation[];
}

interface CreateAffectationInput {
  agentId: string;
  posteVehiculeId: string;
  date: string;
  creneauTypeId?: string;
  heureDebutPerso?: string;
  heureFinPerso?: string;
}

// Réservé admin/superadmin (policy RLS). Aucune contrainte d'unicité en
// base sur (poste, date) : plusieurs affectations peuvent coexister sur le
// même poste le même jour — c'est ce qui permet de scinder un poste entre
// deux agents avec des horaires différents (garde matin / garde soir).
export async function createAffectation(input: CreateAffectationInput): Promise<void> {
  const { error } = await supabase.from('affectations').insert({
    agent_id: input.agentId,
    poste_vehicule_id: input.posteVehiculeId,
    date: input.date,
    creneau_type_id: input.creneauTypeId ?? null,
    heure_debut_perso: input.heureDebutPerso ?? null,
    heure_fin_perso: input.heureFinPerso ?? null,
  });
  if (error) throw error;
}

export async function deleteAffectation(id: string): Promise<void> {
  const { error } = await supabase.from('affectations').delete().eq('id', id);
  if (error) throw error;
}
