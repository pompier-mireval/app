-- ============================================================
--  Migration v13 — à exécuter dans SQL Editor après schema_v12.sql
--  Page Inventaire des véhicules.
--    - inventaire_items     : liste du matériel de chaque véhicule
--                             (saisie superadmin, par zone/coffre)
--    - inventaire_controles : contrôles faits par les agents
--    - inventaire_manques   : matériel manquant/défectueux relevé lors d'un
--                             contrôle, avec statut de suivi (admins)
-- ============================================================

create table if not exists inventaire_items (
  id          uuid primary key default gen_random_uuid(),
  vehicule_id uuid not null references vehicules(id) on delete cascade,
  zone        text not null default 'Général' check (char_length(zone) between 1 and 100),
  nom         text not null check (char_length(nom) between 1 and 200),
  quantite    int not null default 1 check (quantite between 1 and 999),
  ordre       int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists inventaire_items_vehicule_idx on inventaire_items (vehicule_id, zone, ordre);

create table if not exists inventaire_controles (
  id          uuid primary key default gen_random_uuid(),
  vehicule_id uuid not null references vehicules(id) on delete cascade,
  agent_id    uuid not null references agents(id) on delete cascade,
  nb_items    int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists inventaire_controles_idx on inventaire_controles (vehicule_id, created_at desc);

create table if not exists inventaire_manques (
  id                 uuid primary key default gen_random_uuid(),
  controle_id        uuid not null references inventaire_controles(id) on delete cascade,
  vehicule_id        uuid not null references vehicules(id) on delete cascade,
  agent_id           uuid not null references agents(id) on delete cascade,
  item_id            uuid references inventaire_items(id) on delete set null,
  zone               text not null,
  item_nom           text not null,
  quantite_attendue  int not null,
  quantite_constatee int not null default 0 check (quantite_constatee >= 0),
  probleme           text not null default 'manquant' check (probleme in ('manquant', 'defectueux')),
  commentaire        text check (commentaire is null or char_length(commentaire) <= 1000),
  statut             text not null default 'a_traiter' check (statut in ('a_traiter', 'regle')),
  created_at         timestamptz not null default now(),
  regle_at           timestamptz
);
create index if not exists inventaire_manques_idx on inventaire_manques (statut, created_at desc);

create or replace function is_admin_ou_plus()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_niveau_acces() in ('admin', 'superadmin');
$$;

alter table inventaire_items enable row level security;
alter table inventaire_controles enable row level security;
alter table inventaire_manques enable row level security;

drop policy if exists "lecture inventaire_items" on inventaire_items;
create policy "lecture inventaire_items" on inventaire_items for select
  using (auth.uid() is not null);
drop policy if exists "ecriture inventaire_items superadmin" on inventaire_items;
create policy "ecriture inventaire_items superadmin" on inventaire_items for all
  using (current_niveau_acces() = 'superadmin')
  with check (current_niveau_acces() = 'superadmin');

drop policy if exists "lecture inventaire_controles" on inventaire_controles;
create policy "lecture inventaire_controles" on inventaire_controles for select
  using (auth.uid() is not null);
drop policy if exists "creation inventaire_controles" on inventaire_controles;
create policy "creation inventaire_controles" on inventaire_controles for insert
  with check (agent_id = current_agent_id());
drop policy if exists "suppression inventaire_controles" on inventaire_controles;
create policy "suppression inventaire_controles" on inventaire_controles for delete
  using (current_niveau_acces() = 'superadmin');

-- Le suivi des manquants est visible des admins (et de l'auteur du contrôle).
drop policy if exists "lecture inventaire_manques" on inventaire_manques;
create policy "lecture inventaire_manques" on inventaire_manques for select
  using (is_admin_ou_plus() or agent_id = current_agent_id());
drop policy if exists "creation inventaire_manques" on inventaire_manques;
create policy "creation inventaire_manques" on inventaire_manques for insert
  with check (
    agent_id = current_agent_id()
    and statut = 'a_traiter' and regle_at is null
    and exists (select 1 from inventaire_controles c where c.id = controle_id and c.agent_id = current_agent_id())
  );
drop policy if exists "maj inventaire_manques" on inventaire_manques;
create policy "maj inventaire_manques" on inventaire_manques for update
  using (is_admin_ou_plus()) with check (is_admin_ou_plus());
drop policy if exists "suppression inventaire_manques" on inventaire_manques;
create policy "suppression inventaire_manques" on inventaire_manques for delete
  using (current_niveau_acces() = 'superadmin');
