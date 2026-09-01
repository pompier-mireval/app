import { supabase } from '../lib/supabaseClient';
import type { Agent } from '../lib/types';

export async function fetchAgents(): Promise<Agent[]> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .order('nom', { ascending: true });
  if (error) throw error;
  return data as Agent[];
}

export async function fetchCurrentAgent(): Promise<Agent | null> {
  const { data: session } = await supabase.auth.getUser();
  if (!session.user) return null;

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('auth_user_id', session.user.id)
    .maybeSingle();
  if (error) throw error;
  return data as Agent | null;
}

export async function fetchAgentById(id: string): Promise<Agent | null> {
  const { data, error } = await supabase.from('agents').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Agent | null;
}

export async function updateAgentNote(agentId: string, note: string): Promise<void> {
  const { error } = await supabase
    .from('agents')
    .update({ note_dispo: note })
    .eq('id', agentId);
  if (error) throw error;
}

// Un agent peut modifier son propre numéro (comme sa note) ; un admin+
// peut aussi le faire pour n'importe qui (policy RLS).
export async function updateAgentTelephone(agentId: string, telephone: string): Promise<void> {
  const { error } = await supabase.from('agents').update({ telephone }).eq('id', agentId);
  if (error) throw error;
}

// Réservé admin/superadmin — protégé aussi par un trigger côté base
// (protect_grade_id) qui refuse la modification à un simple utilisateur
// même si cette fonction était appelée directement.
export async function updateAgentGrade(agentId: string, gradeId: string | null): Promise<void> {
  const { error } = await supabase.from('agents').update({ grade_id: gradeId }).eq('id', agentId);
  if (error) throw error;
}

// Réservé admin/superadmin — la vraie restriction vient de la policy RLS,
// cet appel échouera silencieusement (0 ligne affectée) pour un utilisateur
// standard même si le bouton était affiché par erreur côté UI.
export async function updateAgentIdentity(
  agentId: string,
  fields: Pick<Agent, 'nom' | 'prenom'>
): Promise<void> {
  const { error } = await supabase.from('agents').update(fields).eq('id', agentId);
  if (error) throw error;
}

// Réservé superadmin (policy RLS)
export async function updateNiveauAcces(agentId: string, niveau: Agent['niveau_acces']): Promise<void> {
  const { error } = await supabase
    .from('agents')
    .update({ niveau_acces: niveau })
    .eq('id', agentId);
  if (error) throw error;
}

// Réservé admin/superadmin (policy RLS) — désactivation plutôt que
// suppression : un agent a un historique (affectations, dispos) qu'on ne
// veut jamais perdre. `actif = false` le retire des listes actives sans
// casser les références existantes.
export async function setAgentActif(agentId: string, actif: boolean): Promise<void> {
  const { error } = await supabase.from('agents').update({ actif }).eq('id', agentId);
  if (error) throw error;
}
