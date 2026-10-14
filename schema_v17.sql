-- ============================================================
--  Migration v17 — à exécuter dans SQL Editor après schema_v16.sql
--  Vérification / Inventaire / Petit matériel : seuls les responsables
--  désignés (par un superadmin, un groupe par famille) peuvent changer
--  le statut des anomalies. Le superadmin garde la main (il désigne).
-- ============================================================

create table if not exists responsables_controle (
  famille  text not null check (famille in ('inventaire', 'verification', 'materiel')),
  agent_id uuid not null references agents(id) on delete cascade,
  primary key (famille, agent_id)
);

create or replace function is_responsable_controle(fam text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from responsables_controle
    where famille = fam and agent_id = current_agent_id()
  );
$$;

alter table responsables_controle enable row level security;
drop policy if exists "lecture responsables_controle" on responsables_controle;
create policy "lecture responsables_controle" on responsables_controle for select
  using (auth.uid() is not null);
drop policy if exists "ecriture responsables_controle superadmin" on responsables_controle;
create policy "ecriture responsables_controle superadmin" on responsables_controle for all
  using (current_niveau_acces() = 'superadmin')
  with check (current_niveau_acces() = 'superadmin');

-- Lecture : admins, responsables de la famille, auteur du contrôle.
drop policy if exists "lecture inventaire_manques" on inventaire_manques;
create policy "lecture inventaire_manques" on inventaire_manques for select
  using (is_admin_ou_plus() or is_responsable_controle(famille) or agent_id = current_agent_id());

-- Changement de statut : responsables de la famille (et superadmin).
drop policy if exists "maj inventaire_manques" on inventaire_manques;
create policy "maj inventaire_manques" on inventaire_manques for update
  using (is_responsable_controle(famille) or current_niveau_acces() = 'superadmin')
  with check (is_responsable_controle(famille) or current_niveau_acces() = 'superadmin');
