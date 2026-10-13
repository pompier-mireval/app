-- ============================================================
--  Migration v9 — à exécuter dans SQL Editor après schema_v8.sql
--  Révision : le PDF d'origine est conservé dans un bucket privé pour que
--  les sources citées par le chatbot ouvrent le document à la bonne page.
--  Le bucket n'a aucune policy de lecture : seule l'Edge Function
--  (clé service) crée des liens signés temporaires.
-- ============================================================

alter table revision_documents add column if not exists fichier text;

insert into storage.buckets (id, name, public)
values ('revision-pdfs', 'revision-pdfs', false)
on conflict (id) do nothing;

drop policy if exists "revision-pdfs ecriture superadmin" on storage.objects;
create policy "revision-pdfs ecriture superadmin" on storage.objects for all
  using (bucket_id = 'revision-pdfs' and public.current_niveau_acces() = 'superadmin')
  with check (bucket_id = 'revision-pdfs' and public.current_niveau_acces() = 'superadmin');
