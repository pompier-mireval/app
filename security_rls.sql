-- ============================================================
--  Correctif sécurité — Row Level Security
-- ============================================================
-- À exécuter une fois dans le SQL Editor Supabase, sur la base existante
-- (après schema.sql + schema_v2.sql, qui ont déjà créé les tables).
--
-- Pourquoi ce fichier existe : l'introspection de la base (fournie le
-- 2026-09-04) montre que les tables ne portent aucune policy RLS. Sur
-- Supabase, tant que RLS n'est pas activé sur une table, PostgREST
-- l'expose intégralement (lecture ET écriture) à quiconque possède la clé
-- anon — qui est publique par design, embarquée dans le bundle JS déployé
-- sur GitHub Pages. Concrètement, avant ce correctif, n'importe qui peut,
-- avec juste la clé anon (visible dans le code source livré au navigateur),
-- appeler l'API REST Supabase directement (sans passer par l'appli) pour :
--   - lire l'email/téléphone de tous les agents,
--   - s'auto-promouvoir superadmin en modifiant sa propre ligne `agents`,
--   - créer/modifier/supprimer gardes, véhicules, affectations, etc.
-- Ce script referme tout ça en n'autorisant que ce que le code front
-- suppose déjà (voir les commentaires dans src/api/*.ts).
--
-- Le script est idempotent : il peut être relancé sans erreur.
-- ============================================================

-- ------------------------------------------------------------
-- Fonctions utilitaires (SECURITY DEFINER : lisent `agents` en
-- contournant RLS, pour éviter toute récursion dans les policies)
-- ------------------------------------------------------------

create or replace function current_agent_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from agents where auth_user_id = auth.uid();
$$;

create or replace function current_niveau_acces()
returns niveau_acces_type
language sql
stable
security definer
set search_path = public
as $$
  select niveau_acces from agents where auth_user_id = auth.uid();
$$;

-- ------------------------------------------------------------
-- Provisionnement automatique d'un agent à l'inscription auth
-- (référencé par le commentaire dans useAuth.tsx, absent jusqu'ici)
-- ------------------------------------------------------------

create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.agents (auth_user_id, email)
  values (new.id, new.email)
  on conflict (email) do update set auth_user_id = excluded.auth_user_id;
  return new;
end;
$$;

drop trigger if exists trg_handle_new_auth_user on auth.users;
create trigger trg_handle_new_auth_user
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ------------------------------------------------------------
-- Garde-fou sur les colonnes sensibles de `agents`
-- (email/niveau_acces/actif/nom/prenom ne doivent pas être modifiables
-- par n'importe qui juste parce qu'il peut modifier sa propre ligne pour
-- son numéro de téléphone ou sa note de dispo)
-- ------------------------------------------------------------

create or replace function protect_agent_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'auth_user_id non modifiable';
  end if;
  if new.email is distinct from old.email then
    raise exception 'email non modifiable depuis l''application';
  end if;
  if new.niveau_acces is distinct from old.niveau_acces
     and current_niveau_acces() is distinct from 'superadmin' then
    raise exception 'Seul un superadmin peut modifier le niveau d''accès';
  end if;
  if (new.actif is distinct from old.actif
      or new.nom is distinct from old.nom
      or new.prenom is distinct from old.prenom)
     and current_niveau_acces() not in ('admin', 'superadmin') then
    raise exception 'Seul un admin ou superadmin peut modifier ces champs';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_agent_privileged_fields on agents;
create trigger trg_protect_agent_privileged_fields
  before update on agents
  for each row execute function protect_agent_privileged_fields();

-- ------------------------------------------------------------
-- agents
-- ------------------------------------------------------------
alter table agents enable row level security;

drop policy if exists "lecture agents" on agents;
create policy "lecture agents" on agents for select
  using (auth.uid() is not null);

-- Un agent modifie sa propre ligne (téléphone, note_dispo, ...) ; un
-- admin/superadmin peut modifier n'importe quelle ligne. Les colonnes
-- vraiment sensibles restent verrouillées par le trigger ci-dessus.
drop policy if exists "ecriture agents" on agents;
create policy "ecriture agents" on agents for update
  using (auth_user_id = auth.uid() or current_niveau_acces() in ('admin', 'superadmin'))
  with check (auth_user_id = auth.uid() or current_niveau_acces() in ('admin', 'superadmin'));

-- Pas de policy insert/delete : la création passe uniquement par le
-- trigger sur auth.users, la désactivation se fait via `actif = false`.

-- ------------------------------------------------------------
-- grades (référentiel) — déjà couvert par schema_v2.sql, on le
-- redéclare ici en idempotent pour que ce fichier seul suffise à auditer.
-- ------------------------------------------------------------
alter table grades enable row level security;

drop policy if exists "lecture grades" on grades;
create policy "lecture grades" on grades for select
  using (auth.uid() is not null);

drop policy if exists "ecriture grades superadmin" on grades;
create policy "ecriture grades superadmin" on grades for all
  using (current_niveau_acces() = 'superadmin')
  with check (current_niveau_acces() = 'superadmin');

-- ------------------------------------------------------------
-- garde_semaines — idem, redéclaré en idempotent
-- ------------------------------------------------------------
alter table garde_semaines enable row level security;

drop policy if exists "lecture garde_semaines" on garde_semaines;
create policy "lecture garde_semaines" on garde_semaines for select
  using (auth.uid() is not null);

drop policy if exists "ecriture garde_semaines admin+" on garde_semaines;
create policy "ecriture garde_semaines admin+" on garde_semaines for all
  using (current_niveau_acces() in ('admin', 'superadmin'))
  with check (current_niveau_acces() in ('admin', 'superadmin'));

-- ------------------------------------------------------------
-- gardes — lecture ouverte, écriture superadmin (createGarde/updateGarde/
-- deleteGarde dans src/api/gardes.ts)
-- ------------------------------------------------------------
alter table gardes enable row level security;

drop policy if exists "lecture gardes" on gardes;
create policy "lecture gardes" on gardes for select
  using (auth.uid() is not null);

drop policy if exists "ecriture gardes superadmin" on gardes;
create policy "ecriture gardes superadmin" on gardes for all
  using (current_niveau_acces() = 'superadmin')
  with check (current_niveau_acces() = 'superadmin');

-- ------------------------------------------------------------
-- agent_gardes — lecture ouverte, écriture superadmin
-- (assignAgentToGarde/removeAgentFromGarde)
-- ------------------------------------------------------------
alter table agent_gardes enable row level security;

drop policy if exists "lecture agent_gardes" on agent_gardes;
create policy "lecture agent_gardes" on agent_gardes for select
  using (auth.uid() is not null);

drop policy if exists "ecriture agent_gardes superadmin" on agent_gardes;
create policy "ecriture agent_gardes superadmin" on agent_gardes for all
  using (current_niveau_acces() = 'superadmin')
  with check (current_niveau_acces() = 'superadmin');

-- ------------------------------------------------------------
-- competences (référentiel) — lecture ouverte, écriture superadmin
-- ------------------------------------------------------------
alter table competences enable row level security;

drop policy if exists "lecture competences" on competences;
create policy "lecture competences" on competences for select
  using (auth.uid() is not null);

drop policy if exists "ecriture competences superadmin" on competences;
create policy "ecriture competences superadmin" on competences for all
  using (current_niveau_acces() = 'superadmin')
  with check (current_niveau_acces() = 'superadmin');

-- ------------------------------------------------------------
-- agent_competences — lecture ouverte, écriture admin+
-- (grantCompetence/revokeCompetence)
-- ------------------------------------------------------------
alter table agent_competences enable row level security;

drop policy if exists "lecture agent_competences" on agent_competences;
create policy "lecture agent_competences" on agent_competences for select
  using (auth.uid() is not null);

drop policy if exists "ecriture agent_competences admin+" on agent_competences;
create policy "ecriture agent_competences admin+" on agent_competences for all
  using (current_niveau_acces() in ('admin', 'superadmin'))
  with check (current_niveau_acces() in ('admin', 'superadmin'));

-- ------------------------------------------------------------
-- vehicules — lecture ouverte, écriture superadmin
-- ------------------------------------------------------------
alter table vehicules enable row level security;

drop policy if exists "lecture vehicules" on vehicules;
create policy "lecture vehicules" on vehicules for select
  using (auth.uid() is not null);

drop policy if exists "ecriture vehicules superadmin" on vehicules;
create policy "ecriture vehicules superadmin" on vehicules for all
  using (current_niveau_acces() = 'superadmin')
  with check (current_niveau_acces() = 'superadmin');

-- ------------------------------------------------------------
-- postes_vehicule — lecture ouverte, écriture superadmin
-- ------------------------------------------------------------
alter table postes_vehicule enable row level security;

drop policy if exists "lecture postes_vehicule" on postes_vehicule;
create policy "lecture postes_vehicule" on postes_vehicule for select
  using (auth.uid() is not null);

drop policy if exists "ecriture postes_vehicule superadmin" on postes_vehicule;
create policy "ecriture postes_vehicule superadmin" on postes_vehicule for all
  using (current_niveau_acces() = 'superadmin')
  with check (current_niveau_acces() = 'superadmin');

-- ------------------------------------------------------------
-- postes_competences — lecture ouverte, écriture superadmin
-- ------------------------------------------------------------
alter table postes_competences enable row level security;

drop policy if exists "lecture postes_competences" on postes_competences;
create policy "lecture postes_competences" on postes_competences for select
  using (auth.uid() is not null);

drop policy if exists "ecriture postes_competences superadmin" on postes_competences;
create policy "ecriture postes_competences superadmin" on postes_competences for all
  using (current_niveau_acces() = 'superadmin')
  with check (current_niveau_acces() = 'superadmin');

-- ------------------------------------------------------------
-- creneaux_types — lecture ouverte, écriture superadmin
-- ------------------------------------------------------------
alter table creneaux_types enable row level security;

drop policy if exists "lecture creneaux_types" on creneaux_types;
create policy "lecture creneaux_types" on creneaux_types for select
  using (auth.uid() is not null);

drop policy if exists "ecriture creneaux_types superadmin" on creneaux_types;
create policy "ecriture creneaux_types superadmin" on creneaux_types for all
  using (current_niveau_acces() = 'superadmin')
  with check (current_niveau_acces() = 'superadmin');

-- ------------------------------------------------------------
-- disponibilites — lecture ouverte (nécessaire pour Planning/Statistiques
-- qui affichent les dispos de tous les agents), écriture limitée à ses
-- propres lignes sauf pour admin/superadmin qui peuvent agir pour
-- n'importe qui (cf. commentaire dans src/api/disponibilites.ts)
-- ------------------------------------------------------------
alter table disponibilites enable row level security;

drop policy if exists "lecture disponibilites" on disponibilites;
create policy "lecture disponibilites" on disponibilites for select
  using (auth.uid() is not null);

drop policy if exists "ecriture disponibilites" on disponibilites;
create policy "ecriture disponibilites" on disponibilites for all
  using (agent_id = current_agent_id() or current_niveau_acces() in ('admin', 'superadmin'))
  with check (agent_id = current_agent_id() or current_niveau_acces() in ('admin', 'superadmin'));

-- ------------------------------------------------------------
-- affectations — lecture ouverte, écriture admin+ uniquement
-- (createAffectation/deleteAffectation : "Réservé admin/superadmin")
-- ------------------------------------------------------------
alter table affectations enable row level security;

drop policy if exists "lecture affectations" on affectations;
create policy "lecture affectations" on affectations for select
  using (auth.uid() is not null);

drop policy if exists "ecriture affectations admin+" on affectations;
create policy "ecriture affectations admin+" on affectations for all
  using (current_niveau_acces() in ('admin', 'superadmin'))
  with check (current_niveau_acces() in ('admin', 'superadmin'));
