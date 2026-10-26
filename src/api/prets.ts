import { supabase } from '../lib/supabaseClient';
import type { PretVehicule, StatutPret } from '../lib/types';

// Prêts récents et à venir (les plus anciens ne servent plus à l'écran).
export async function fetchPrets(depuis: string): Promise<PretVehicule[]> {
  const { data, error } = await supabase
    .from('prets_vehicule')
    .select('*')
    .gte('fin', depuis)
    .order('debut')
    .limit(300);
  if (error) throw error;
  return data as PretVehicule[];
}

export async function createPret(input: {
  vehiculeId: string;
  emprunteurId: string;
  debut: string;
  fin: string;
  motif: string;
}): Promise<void> {
  const { error } = await supabase.from('prets_vehicule').insert({
    vehicule_id: input.vehiculeId,
    emprunteur_id: input.emprunteurId,
    debut: input.debut,
    fin: input.fin,
    motif: input.motif || null,
  });
  if (error) throw error;
}

// Admin de garde pendant le prêt ou superadmin (policy RLS) ; le validateur
// et la date sont renseignés par un trigger (schema_v22.sql).
export async function setPretStatut(id: string, statut: StatutPret): Promise<void> {
  const { error } = await supabase.from('prets_vehicule').update({ statut }).eq('id', id);
  if (error) throw error;
}

export async function deletePret(id: string): Promise<void> {
  const { error } = await supabase.from('prets_vehicule').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchMesPretsValidables(): Promise<string[]> {
  const { data, error } = await supabase.rpc('mes_prets_validables');
  if (error) throw error;
  return (data ?? []) as string[];
}
