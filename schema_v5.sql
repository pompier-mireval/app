-- ============================================================
--  Migration v5 — à exécuter dans SQL Editor après schema_v4.sql
--  Page Mécanique : signalement d'un souci sur un véhicule.
--    - responsables_mecanique : agents qui suivent et clôturent les
--                               signalements (choisis par un superadmin)
--    - signalements_mecanique : historique des signalements
-- ============================================================

create table if not exists responsables_mecanique (
  agent_id   uuid primary key references agents(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists signalements_mecanique (
  id          uuid primary key default gen_random_uuid(),
  vehicule_id uuid not null references vehicules(id) on delete cascade,
  agent_id    uuid not null references agents(id) on delete cascade,
  description text not null check (char_length(description) between 1 and 2000),
  urgence     text not null default 'normale' check (urgence in ('normale', 'urgente')),
  statut      text not null default 'ouvert' check (statut in ('ouvert', 'resolu')),
  created_at  timestamptz not null default now(),
  resolu_at   timestamptz
);
create index if not exists signalements_mecanique_created_idx on signalements_mecanique (created_at desc);

create or replace function is_responsable_mecanique()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from responsables_mecanique where agent_id = current_agent_id());
$$;

alter table responsables_mecanique enable row level security;
alter table signalements_mecanique enable row level security;

drop policy if exists "lecture responsables_mecanique" on responsables_mecanique;
create policy "lecture responsables_mecanique" on responsables_mecanique for select
  using (auth.uid() is not null);
drop policy if exists "ecriture responsables_mecanique superadmin" on responsables_mecanique;
create policy "ecriture responsables_mecanique superadmin" on responsables_mecanique for all
  using (current_niveau_acces() = 'superadmin')
  with check (current_niveau_acces() = 'superadmin');

drop policy if exists "lecture signalements_mecanique" on signalements_mecanique;
create policy "lecture signalements_mecanique" on signalements_mecanique for select
  using (auth.uid() is not null);
-- Tout agent signale en son nom ; le statut ne se fixe pas à l'insert.
drop policy if exists "creation signalements_mecanique" on signalements_mecanique;
create policy "creation signalements_mecanique" on signalements_mecanique for insert
  with check (agent_id = current_agent_id() and statut = 'ouvert' and resolu_at is null);
-- Clôture / réouverture : responsables et superadmin.
drop policy if exists "maj signalements_mecanique" on signalements_mecanique;
create policy "maj signalements_mecanique" on signalements_mecanique for update
  using (is_responsable_mecanique() or current_niveau_acces() = 'superadmin')
  with check (is_responsable_mecanique() or current_niveau_acces() = 'superadmin');
drop policy if exists "suppression signalements_mecanique" on signalements_mecanique;
create policy "suppression signalements_mecanique" on signalements_mecanique for delete
  using (current_niveau_acces() = 'superadmin');
