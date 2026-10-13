-- ============================================================
--  Migration v7 — à exécuter dans SQL Editor après schema_v6.sql
--  Recherche plein texte (français, sans accents) dans les pages de
--  révision : le chatbot ne reçoit que les pages les plus pertinentes
--  au lieu de tout le corpus.
-- ============================================================

create extension if not exists unaccent with schema extensions;

create or replace function public.f_unaccent(t text)
returns text
language sql
immutable
parallel safe
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, t) $$;

alter table revision_pages
  add column if not exists fts tsvector
  generated always as (to_tsvector('french', public.f_unaccent(contenu))) stored;

create index if not exists revision_pages_fts_idx on revision_pages using gin (fts);

-- Recherche "au moins un des mots", classée par pertinence. Réservée à la
-- fonction chat-revision (clé service) : les agents n'ont pas accès au texte.
create or replace function public.search_revision_pages(mots text[], nb int default 25)
returns table (document_id uuid, page int, contenu text, rang real)
language sql
stable
as $$
  select p.document_id, p.page, p.contenu, ts_rank_cd(p.fts, q.query) as rang
  from revision_pages p,
       lateral (select to_tsquery('french', array_to_string(array(select public.f_unaccent(m) from unnest(mots) m), ' | ')) as query) q
  where p.fts @@ q.query
  order by rang desc
  limit nb
$$;

revoke execute on function public.search_revision_pages(text[], int) from public, anon, authenticated;
grant execute on function public.search_revision_pages(text[], int) to service_role;

-- Les agents n'ont pas à voir la liste des documents : seul le superadmin
-- les gère (la fonction chat-revision lit la base avec la clé service).
drop policy if exists "lecture revision_documents" on revision_documents;
drop policy if exists "lecture revision_documents superadmin" on revision_documents;
-- (la policy "ecriture revision_documents superadmin" de schema_v6.sql, de
-- type "for all", couvre aussi la lecture pour le superadmin)
