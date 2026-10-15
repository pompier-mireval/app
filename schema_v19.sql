-- Plusieurs disponibilités par agent et par jour (jour, nuit, créneaux…).
-- Supprime toute contrainte d'unicité éventuelle sur (agent_id, date) de
-- la table disponibilites ; sans effet si elle n'existe pas.
do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.disponibilites'::regclass
      and c.contype = 'u'
      and (select array_agg(a.attname::text order by a.attname)
           from unnest(c.conkey) k join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k)
          = array['agent_id', 'date']
  loop
    execute format('alter table public.disponibilites drop constraint %I', r.conname);
  end loop;
end $$;

-- Idem pour un index unique créé hors contrainte.
do $$
declare r record;
begin
  for r in
    select i.indexname from pg_indexes i
    where i.schemaname = 'public' and i.tablename = 'disponibilites'
      and i.indexdef ilike 'create unique index%(agent_id, date)%'
      and not exists (select 1 from pg_constraint c where c.conname = i.indexname)
  loop
    execute format('drop index public.%I', r.indexname);
  end loop;
end $$;
