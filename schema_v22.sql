-- Prêts de véhicule : le superadmin choisit, parmi les véhicules existants
-- (table vehicules), ceux qui peuvent être prêtés ; tout agent
-- peut demander un prêt ; un admin membre d'une garde de service pendant le
-- prêt (ou le superadmin) le valide ou le refuse. On garde la trace de qui
-- emprunte et de qui a validé.

-- La policy d'écriture existante sur vehicules (superadmin) couvre ce champ.
alter table vehicules add column if not exists pretable boolean not null default false;

create table if not exists prets_vehicule (
  id                uuid primary key default gen_random_uuid(),
  vehicule_id       uuid not null references vehicules(id) on delete cascade,
  emprunteur_id     uuid not null references agents(id) on delete cascade,
  debut             timestamptz not null,
  fin               timestamptz not null,
  motif             text,
  statut            text not null default 'en_attente'
                    check (statut in ('en_attente', 'valide', 'refuse')),
  valide_par        uuid references agents(id) on delete set null,
  valide_at         timestamptz,
  created_at        timestamptz not null default now(),
  check (fin > debut)
);

create index if not exists prets_vehicule_debut_idx on prets_vehicule (debut);

-- Garde de service à un instant donné (heure de Paris), selon les blocs de
-- l'app (voir gardeBlocOf dans src/lib/dates.ts) :
--   Lun-Ven 7h-19h        -> garde 'jour'    du lundi
--   Lun-Jeu 19h -> 7h     -> garde 'nuit'    du lundi
--   Ven 19h -> Lun 7h     -> garde 'weekend' du vendredi
create or replace function garde_de_service(t timestamptz)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l timestamp := t at time zone 'Europe/Paris';
  -- Avant 7h, on est encore dans la nuit commencée la veille.
  jour date := case when l::time < time '07:00' then (l - interval '1 day')::date else l::date end;
  dow int := extract(isodow from jour); -- 1 = lundi … 7 = dimanche
  de_jour boolean := l::time >= time '07:00' and l::time < time '19:00';
  lundi date := jour - (dow - 1);
  gid uuid;
begin
  if (dow = 5 and not de_jour) or dow in (6, 7) then
    select garde_id into gid from garde_semaines where semaine_debut = lundi + 4 and type = 'weekend';
  elsif de_jour then
    select garde_id into gid from garde_semaines where semaine_debut = lundi and type = 'jour';
  else
    select garde_id into gid from garde_semaines where semaine_debut = lundi and type = 'nuit';
  end if;
  return gid;
end;
$$;

-- Vrai si l'utilisateur courant est admin et membre d'au moins une garde de
-- service sur la période (échantillonnée heure par heure, bornes incluses),
-- ou s'il est superadmin.
create or replace function peut_valider_pret(p_debut timestamptz, p_fin timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_niveau_acces() = 'superadmin'
    or (
      current_niveau_acces() = 'admin'
      and exists (
        select 1
        from (
          select generate_series(p_debut, p_fin, interval '1 hour') as t
          union all select p_fin
        ) s
        where est_membre_de_garde(garde_de_service(s.t))
      )
    );
$$;

-- Prêts (en attente ou déjà traités) que l'utilisateur courant peut valider.
-- Un admin ne valide pas sa propre demande.
create or replace function mes_prets_validables()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id from prets_vehicule p
  where peut_valider_pret(p.debut, p.fin)
    and (current_niveau_acces() = 'superadmin' or p.emprunteur_id is distinct from current_agent_id());
$$;

-- À la validation/au refus : le validateur et la date sont fixés côté base,
-- les autres champs ne bougent plus, et un même véhicule ne peut pas être
-- prêté deux fois sur des périodes qui se chevauchent.
create or replace function prets_vehicule_avant_maj()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.vehicule_id is distinct from old.vehicule_id
     or new.emprunteur_id is distinct from old.emprunteur_id
     or new.debut is distinct from old.debut
     or new.fin is distinct from old.fin
     or new.motif is distinct from old.motif then
    raise exception 'Seul le statut d''un prêt peut être modifié';
  end if;
  if new.statut is distinct from old.statut then
    if new.statut = 'en_attente' then
      new.valide_par := null;
      new.valide_at := null;
    else
      new.valide_par := current_agent_id();
      new.valide_at := now();
    end if;
  else
    new.valide_par := old.valide_par;
    new.valide_at := old.valide_at;
  end if;
  if new.statut = 'valide' and exists (
    select 1 from prets_vehicule p
    where p.id <> new.id
      and p.vehicule_id = new.vehicule_id
      and p.statut = 'valide'
      and p.debut < new.fin and p.fin > new.debut
  ) then
    raise exception 'Ce véhicule est déjà prêté sur une partie de cette période';
  end if;
  return new;
end;
$$;

drop trigger if exists prets_vehicule_avant_maj on prets_vehicule;
create trigger prets_vehicule_avant_maj before update on prets_vehicule
  for each row execute function prets_vehicule_avant_maj();

alter table prets_vehicule enable row level security;

-- Tout le monde voit qui emprunte quoi et qui a validé.
drop policy if exists "lecture prets_vehicule" on prets_vehicule;
create policy "lecture prets_vehicule" on prets_vehicule for select
  using (auth.uid() is not null);

-- Une demande se fait pour soi, toujours en attente.
drop policy if exists "demande prets_vehicule" on prets_vehicule;
create policy "demande prets_vehicule" on prets_vehicule for insert
  with check (est_moi(emprunteur_id) and statut = 'en_attente' and valide_par is null);

drop policy if exists "validation prets_vehicule" on prets_vehicule;
create policy "validation prets_vehicule" on prets_vehicule for update
  using (
    peut_valider_pret(debut, fin)
    and (current_niveau_acces() = 'superadmin' or not est_moi(emprunteur_id))
  )
  with check (
    peut_valider_pret(debut, fin)
    and (current_niveau_acces() = 'superadmin' or not est_moi(emprunteur_id))
  );

-- L'emprunteur annule sa demande tant qu'elle est en attente ; le
-- superadmin peut supprimer n'importe quel prêt.
drop policy if exists "suppression prets_vehicule" on prets_vehicule;
create policy "suppression prets_vehicule" on prets_vehicule for delete
  using (
    (est_moi(emprunteur_id) and statut = 'en_attente')
    or current_niveau_acces() = 'superadmin'
  );
