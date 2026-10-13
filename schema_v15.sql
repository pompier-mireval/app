-- ============================================================
--  Migration v15 — à exécuter dans SQL Editor après schema_v14.sql
--  1) Page Bâtiment : signalement de problèmes dans/sur les bâtiments,
--     avec responsables bâtiment choisis par un superadmin.
--  2) Page Petit matériel : chaque matériel a ses propres contrôles
--     (réutilise les tables de l'inventaire, famille 'materiel').
-- ============================================================

-- ---------- Bâtiment ----------
create table if not exists responsables_batiment (
  agent_id   uuid primary key references agents(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists signalements_batiment (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references agents(id) on delete cascade,
  lieu        text not null check (char_length(lieu) between 1 and 200),
  description text not null check (char_length(description) between 1 and 2000),
  urgence     text not null default 'normale' check (urgence in ('normale', 'urgente')),
  statut      text not null default 'ouvert' check (statut in ('ouvert', 'resolu')),
  created_at  timestamptz not null default now(),
  resolu_at   timestamptz
);
create index if not exists signalements_batiment_created_idx on signalements_batiment (created_at desc);

create or replace function is_responsable_batiment()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from responsables_batiment where agent_id = current_agent_id());
$$;

alter table responsables_batiment enable row level security;
alter table signalements_batiment enable row level security;

drop policy if exists "lecture responsables_batiment" on responsables_batiment;
create policy "lecture responsables_batiment" on responsables_batiment for select
  using (auth.uid() is not null);
drop policy if exists "ecriture responsables_batiment superadmin" on responsables_batiment;
create policy "ecriture responsables_batiment superadmin" on responsables_batiment for all
  using (current_niveau_acces() = 'superadmin')
  with check (current_niveau_acces() = 'superadmin');

drop policy if exists "lecture signalements_batiment" on signalements_batiment;
create policy "lecture signalements_batiment" on signalements_batiment for select
  using (auth.uid() is not null);
drop policy if exists "creation signalements_batiment" on signalements_batiment;
create policy "creation signalements_batiment" on signalements_batiment for insert
  with check (agent_id = current_agent_id() and statut = 'ouvert' and resolu_at is null);
drop policy if exists "maj signalements_batiment" on signalements_batiment;
create policy "maj signalements_batiment" on signalements_batiment for update
  using (is_responsable_batiment() or current_niveau_acces() = 'superadmin')
  with check (is_responsable_batiment() or current_niveau_acces() = 'superadmin');
drop policy if exists "suppression signalements_batiment" on signalements_batiment;
create policy "suppression signalements_batiment" on signalements_batiment for delete
  using (current_niveau_acces() = 'superadmin');

-- ---------- Petit matériel ----------
create table if not exists petit_materiel (
  id         uuid primary key default gen_random_uuid(),
  nom        text not null check (char_length(nom) between 1 and 200),
  created_at timestamptz not null default now()
);
alter table petit_materiel enable row level security;
drop policy if exists "lecture petit_materiel" on petit_materiel;
create policy "lecture petit_materiel" on petit_materiel for select
  using (auth.uid() is not null);
drop policy if exists "ecriture petit_materiel superadmin" on petit_materiel;
create policy "ecriture petit_materiel superadmin" on petit_materiel for all
  using (current_niveau_acces() = 'superadmin')
  with check (current_niveau_acces() = 'superadmin');

-- Les tables de contrôle portent soit un véhicule, soit un petit matériel.
alter table inventaire_items     drop constraint if exists inventaire_items_famille_check;
alter table inventaire_controles drop constraint if exists inventaire_controles_famille_check;
alter table inventaire_manques   drop constraint if exists inventaire_manques_famille_check;
alter table inventaire_items     add constraint inventaire_items_famille_check     check (famille in ('inventaire', 'verification', 'materiel'));
alter table inventaire_controles add constraint inventaire_controles_famille_check check (famille in ('inventaire', 'verification', 'materiel'));
alter table inventaire_manques   add constraint inventaire_manques_famille_check   check (famille in ('inventaire', 'verification', 'materiel'));

alter table inventaire_items     alter column vehicule_id drop not null;
alter table inventaire_controles alter column vehicule_id drop not null;
alter table inventaire_manques   alter column vehicule_id drop not null;

alter table inventaire_items     add column if not exists materiel_id uuid references petit_materiel(id) on delete cascade;
alter table inventaire_controles add column if not exists materiel_id uuid references petit_materiel(id) on delete cascade;
alter table inventaire_manques   add column if not exists materiel_id uuid references petit_materiel(id) on delete cascade;

alter table inventaire_items     drop constraint if exists inventaire_items_sujet_check;
alter table inventaire_controles drop constraint if exists inventaire_controles_sujet_check;
alter table inventaire_manques   drop constraint if exists inventaire_manques_sujet_check;
alter table inventaire_items     add constraint inventaire_items_sujet_check     check ((vehicule_id is not null) <> (materiel_id is not null));
alter table inventaire_controles add constraint inventaire_controles_sujet_check check ((vehicule_id is not null) <> (materiel_id is not null));
alter table inventaire_manques   add constraint inventaire_manques_sujet_check   check ((vehicule_id is not null) <> (materiel_id is not null));

create index if not exists inventaire_items_materiel_idx on inventaire_items (materiel_id);
