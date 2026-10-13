import { supabase } from '../lib/supabaseClient';

export interface RevisionDocument {
  id: string;
  nom: string;
  nb_pages: number;
  fichier: string | null;
  created_at: string;
}

export async function fetchRevisionDocuments(): Promise<RevisionDocument[]> {
  const { data, error } = await supabase.from('revision_documents').select('*').order('nom');
  if (error) throw error;
  return data as RevisionDocument[];
}

// Réservé superadmin (policy RLS). Les pages sont insérées par lots pour
// rester sous la limite de taille de requête. Un document de même nom est
// remplacé, ce qui permet de ré-importer un PDF pour y joindre le fichier.
export async function addRevisionDocument(nom: string, pages: string[], file: File): Promise<void> {
  const { data: anciens } = await supabase.from('revision_documents').select('id').eq('nom', nom);
  for (const a of anciens ?? []) await deleteRevisionDocument(a.id as string);

  const { data, error } = await supabase
    .from('revision_documents')
    .insert({ nom, nb_pages: pages.length })
    .select('id')
    .single();
  if (error) throw error;
  const chemin = `${data.id}.pdf`;
  try {
    const { error: upErr } = await supabase.storage.from('revision-pdfs').upload(chemin, file, { contentType: 'application/pdf' });
    if (upErr) throw upErr;
    await supabase.from('revision_documents').update({ fichier: chemin }).eq('id', data.id);
    for (let i = 0; i < pages.length; i += 50) {
      const rows = pages.slice(i, i + 50).map((contenu, j) => ({ document_id: data.id, page: i + j + 1, contenu }));
      const { error: pErr } = await supabase.from('revision_pages').insert(rows);
      if (pErr) throw pErr;
    }
  } catch (err) {
    await deleteRevisionDocument(data.id);
    throw err;
  }
}

export async function deleteRevisionDocument(id: string): Promise<void> {
  await supabase.storage.from('revision-pdfs').remove([`${id}.pdf`]);
  const { error } = await supabase.from('revision_documents').delete().eq('id', id);
  if (error) throw error;
}

export interface RevisionSource {
  nom: string;
  page: number;
  url: string | null;
}

export interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  sources?: Record<string, RevisionSource>;
}

export async function askRevision(question: string, history: ChatMessage[]): Promise<{ answer: string; sources: Record<string, RevisionSource> }> {
  const { data, error } = await supabase.functions.invoke('chat-revision', { body: { question, history: history.map(({ role, text }) => ({ role, text })) } });
  if (error) {
    // L'erreur détaillée de la fonction est dans le corps de la réponse.
    const detail = await (error as any).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? 'Le chatbot est indisponible.');
  }
  return { answer: data.answer as string, sources: (data.sources ?? {}) as Record<string, RevisionSource> };
}
