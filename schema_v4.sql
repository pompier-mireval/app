-- ============================================================
--  Migration v4 — à exécuter dans SQL Editor après schema_v3.sql
--  Astreintes de la garde de jour (Lun-Ven) :
--    - astreintes        : qui est d'astreinte quel jour (sert aussi
--                          d'historique pour équilibrer la charge)
--    - astreinte_config  : ligne unique — nombre max d'astreints par jour
--                          et compétences qui définissent les 3 catégories
-- ============================================================

create table if not exists astreintes (
  id         uuid primary key default gen_random_uuid(),
  agent_id   uuid not null references agents(id) on delete cascade,
  date       date not null,
  created_by uuid references agents(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (agent_id, date)
);
create index if not exists astreintes_date_idx on astreintes (date);

create table if not exists astreinte_config (
  id                        int primary key default 1 check (id = 1),
  nb_max                    int not null default 7 check (nb_max between 3 and 50),
  competence_ca_id          uuid references competences(id) on delete set null,
  competence_conducteur_id  uuid references competences(id) on delete set null,
  competence_equipier_id    uuid references competences(id) on delete set null
);
insert into astreinte_config (id) values (1) on conflict do nothing;

alter table astreintes enable row level security;
alter table astreinte_config enable row level security;

drop policy if exists "lecture astreintes" on astreintes;
create policy "lecture astreintes" on astreintes for select
  using (auth.uid() is not null);
drop policy if exists "ecriture astreintes admin+" on astreintes;
create policy "ecriture astreintes admin+" on astreintes for all
  using (current_niveau_acces() in ('admin', 'superadmin'))
  with check (current_niveau_acces() in ('admin', 'superadmin'));

drop policy if exists "lecture astreinte_config" on astreinte_config;
create policy "lecture astreinte_config" on astreinte_config for select
  using (auth.uid() is not null);
drop policy if exists "ecriture astreinte_config admin+" on astreinte_config;
create policy "ecriture astreinte_config admin+" on astreinte_config for all
  using (current_niveau_acces() in ('admin', 'superadmin'))
  with check (current_niveau_acces() in ('admin', 'superadmin'));
