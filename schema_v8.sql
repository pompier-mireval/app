-- ============================================================
--  Migration v8 — à exécuter après schema_v7.sql
--  Recherche en deux temps pour le chatbot : d'abord les pages qui
--  contiennent TOUS les mots de la question (plus pertinent), puis,
--  en secours, celles qui en contiennent au moins un.
-- ============================================================

create or replace function public.search_revision_pages(mots text[], nb int default 25, strict boolean default false)
returns table (document_id uuid, page int, contenu text, rang real)
language sql
stable
as $$
  select p.document_id, p.page, p.contenu, ts_rank_cd(p.fts, q.query) as rang
  from revision_pages p,
       lateral (select to_tsquery('french', array_to_string(array(select public.f_unaccent(m) from unnest(mots) m), case when strict then ' & ' else ' | ' end)) as query) q
  where p.fts @@ q.query
  order by rang desc
  limit nb
$$;

revoke execute on function public.search_revision_pages(text[], int, boolean) from public, anon, authenticated;
grant execute on function public.search_revision_pages(text[], int, boolean) to service_role;
