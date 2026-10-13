-- ============================================================
--  Migration v6 — à exécuter dans SQL Editor après schema_v5.sql
--  Onglet Révision : chatbot qui répond uniquement d'après les PDF
--  déposés par le superadmin. Le texte des PDF est extrait dans le
--  navigateur au dépôt, puis lu par l'Edge Function chat-revision
--  (supabase/functions/chat-revision), seule à le voir.
-- ============================================================

create table if not exists revision_documents (
  id         uuid primary key default gen_random_uuid(),
  nom        text not null check (char_length(nom) between 1 and 200),
  nb_pages   int not null,
  created_by uuid references agents(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists revision_pages (
  document_id uuid not null references revision_documents(id) on delete cascade,
  page        int not null,
  contenu     text not null,
  primary key (document_id, page)
);

alter table revision_documents enable row level security;
alter table revision_pages enable row level security;

drop policy if exists "lecture revision_documents" on revision_documents;
create policy "lecture revision_documents" on revision_documents for select
  using (auth.uid() is not null);
drop policy if exists "ecriture revision_documents superadmin" on revision_documents;
create policy "ecriture revision_documents superadmin" on revision_documents for all
  using (current_niveau_acces() = 'superadmin')
  with check (current_niveau_acces() = 'superadmin');

-- Le contenu des pages n'est lisible que par le superadmin (et par la
-- fonction, via la clé service) : les agents passent par le chatbot.
drop policy if exists "lecture revision_pages superadmin" on revision_pages;
drop policy if exists "ecriture revision_pages superadmin" on revision_pages;
create policy "ecriture revision_pages superadmin" on revision_pages for all
  using (current_niveau_acces() = 'superadmin')
  with check (current_niveau_acces() = 'superadmin');
