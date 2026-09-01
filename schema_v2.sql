-- ============================================================
--  Migration v2 — à exécuter dans SQL Editor après schema.sql
--  Ajoute : grades, téléphone agent, garde "de service" par semaine
-- ============================================================

-- ---------- GRADES (référentiel, un seul grade par agent) ----------
create table grades (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null unique,
  ordre       int not null default 0,   -- pour trier hiérarchiquement à l'affichage
  created_at  timestamptz not null default now()
);

alter table agents add column grade_id uuid references grades(id);
alter table agents add column telephone text;

-- ---------- GARDE DE LA SEMAINE ----------
-- Une seule garde "de service" par semaine (semaine_debut = un lundi)
create table garde_semaines (
  id             uuid primary key default gen_random_uuid(),
  semaine_debut  date not null unique,
  garde_id       uuid not null references gardes(id) on delete cascade,
  created_by     uuid references agents(id),
  created_at     timestamptz not null default now()
);

-- ============================================================
-- GARDE-FOU : le grade ne se change pas comme une note personnelle
-- ============================================================

create or replace function protect_grade_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.grade_id is distinct from old.grade_id
     and current_niveau_acces() not in ('admin', 'superadmin') then
    raise exception 'Seul un admin ou superadmin peut modifier le grade';
  end if;
  return new;
end;
$$;

create trigger trg_protect_grade_id
  before update on agents
  for each row execute function protect_grade_id();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table grades enable row level security;
alter table garde_semaines enable row level security;

create policy "lecture grades" on grades for select
  using (auth.uid() is not null);
create policy "ecriture grades superadmin" on grades for all
  using (current_niveau_acces() = 'superadmin')
  with check (current_niveau_acces() = 'superadmin');

create policy "lecture garde_semaines" on garde_semaines for select
  using (auth.uid() is not null);
create policy "ecriture garde_semaines admin+" on garde_semaines for all
  using (current_niveau_acces() in ('admin', 'superadmin'))
  with check (current_niveau_acces() in ('admin', 'superadmin'));
