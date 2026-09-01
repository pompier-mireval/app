import { supabase } from '../lib/supabaseClient';
import type { Grade } from '../lib/types';

export async function fetchGrades(): Promise<Grade[]> {
  const { data, error } = await supabase.from('grades').select('*').order('ordre');
  if (error) throw error;
  return data as Grade[];
}

// Réservé superadmin (policy RLS) — gestion du référentiel
export async function createGrade(nom: string, ordre: number): Promise<void> {
  const { error } = await supabase.from('grades').insert({ nom, ordre });
  if (error) throw error;
}

export async function updateGrade(id: string, nom: string, ordre: number): Promise<void> {
  const { error } = await supabase.from('grades').update({ nom, ordre }).eq('id', id);
  if (error) throw error;
}

export async function deleteGrade(id: string): Promise<void> {
  const { error } = await supabase.from('grades').delete().eq('id', id);
  if (error) throw error;
}
