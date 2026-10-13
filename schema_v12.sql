-- ============================================================
--  Migration v12 — à exécuter dans SQL Editor après schema_v11.sql
--  Page Habillement : demandes de changement de vêtement.
--    - responsables_habillement : référents habillement (choisis par un
--                                 superadmin) qui traitent les demandes
--    - demandes_habillement     : visibles UNIQUEMENT par leur auteur et
--                                 par les référents habillement
-- ============================================================

create table if not exists responsables_habillement (
  agent_id   uuid primary key references agents(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists demandes_habillement (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references agents(id) on delete cascade,
  type        text not null check (type in ('polo', 'veste_tsi', 'pantalon', 'surpantalon', 'veste_f1', 'rangers', 'autre')),
  type_autre  text check (type_autre is null or char_length(type_autre) between 1 and 100),
  code        text check (code is null or char_length(code) between 1 and 200),
  motif       text not null check (char_length(motif) between 1 and 2000),
  statut      text not null default 'en_attente' check (statut in ('en_attente', 'acceptee', 'refusee', 'livree')),
  created_at  timestamptz not null default now(),
  traite_at   timestamptz,
  check (type <> 'autre' or type_autre is not null)
);
create index if not exists demandes_habillement_created_idx on demandes_habillement (created_at desc);

create or replace function is_responsable_habillement()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from responsables_habillement where agent_id = current_agent_id());
$$;

alter table responsables_habillement enable row level security;
alter table demandes_habillement enable row level security;

drop policy if exists "lecture responsables_habillement" on responsables_habillement;
create policy "lecture responsables_habillement" on responsables_habillement for select
  using (auth.uid() is not null);
drop policy if exists "ecriture responsables_habillement superadmin" on responsables_habillement;
create policy "ecriture responsables_habillement superadmin" on responsables_habillement for all
  using (current_niveau_acces() = 'superadmin')
  with check (current_niveau_acces() = 'superadmin');

-- Confidentialité : auteur + référents habillement, personne d'autre
-- (pas même un admin ou un superadmin qui n'est pas référent).
drop policy if exists "lecture demandes_habillement" on demandes_habillement;
create policy "lecture demandes_habillement" on demandes_habillement for select
  using (agent_id = current_agent_id() or is_responsable_habillement());
drop policy if exists "creation demandes_habillement" on demandes_habillement;
create policy "creation demandes_habillement" on demandes_habillement for insert
  with check (agent_id = current_agent_id() and statut = 'en_attente' and traite_at is null);
drop policy if exists "maj demandes_habillement" on demandes_habillement;
create policy "maj demandes_habillement" on demandes_habillement for update
  using (is_responsable_habillement())
  with check (is_responsable_habillement());
drop policy if exists "suppression demandes_habillement" on demandes_habillement;
create policy "suppression demandes_habillement" on demandes_habillement for delete
  using (is_responsable_habillement() or (agent_id = current_agent_id() and statut = 'en_attente'));
