import { supabase } from '../lib/supabaseClient';

export interface RevisionDocument {
  id: string;
  nom: string;
  nb_pages: number;
  created_at: string;
}

export async function fetchRevisionDocuments(): Promise<RevisionDocument[]> {
  const { data, error } = await supabase.from('revision_documents').select('*').order('nom');
  if (error) throw error;
  return data as RevisionDocument[];
}

// Réservé superadmin (policy RLS). Les pages sont insérées par lots pour
// rester sous la limite de taille de requête.
export async function addRevisionDocument(nom: string, pages: string[]): Promise<void> {
  const { data, error } = await supabase
    .from('revision_documents')
    .insert({ nom, nb_pages: pages.length })
    .select('id')
    .single();
  if (error) throw error;
  try {
    for (let i = 0; i < pages.length; i += 50) {
      const rows = pages.slice(i, i + 50).map((contenu, j) => ({ document_id: data.id, page: i + j + 1, contenu }));
      const { error: pErr } = await supabase.from('revision_pages').insert(rows);
      if (pErr) throw pErr;
    }
  } catch (err) {
    await supabase.from('revision_documents').delete().eq('id', data.id);
    throw err;
  }
}

export async function deleteRevisionDocument(id: string): Promise<void> {
  const { error } = await supabase.from('revision_documents').delete().eq('id', id);
  if (error) throw error;
}

export interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
}

export async function askRevision(question: string, history: ChatMessage[]): Promise<string> {
  const { data, error } = await supabase.functions.invoke('chat-revision', { body: { question, history } });
  if (error) {
    // L'erreur détaillée de la fonction est dans le corps de la réponse.
    const detail = await (error as any).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? 'Le chatbot est indisponible.');
  }
  return data.answer as string;
}
