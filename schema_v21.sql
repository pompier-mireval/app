-- Chef de garde = admin : un admin peut ajouter/retirer des agents dans les
-- gardes dont il est lui-même membre (pas les autres, pas lui-même).
-- Créer/renommer/supprimer une garde reste réservé au superadmin.

-- security definer : lit agent_gardes sans repasser par ses policies (sinon
-- « infinite recursion detected in policy »).
create or replace function est_membre_de_garde(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from agent_gardes ag
    join agents a on a.id = ag.agent_id
    where a.auth_user_id = auth.uid() and ag.garde_id = gid
  );
$$;

create or replace function est_moi(aid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from agents where id = aid and auth_user_id = auth.uid());
$$;

drop policy if exists "ecriture agent_gardes admin de la garde" on agent_gardes;
create policy "ecriture agent_gardes admin de la garde" on agent_gardes for all
  using (
    current_niveau_acces() = 'admin'
    and est_membre_de_garde(garde_id)
    and not est_moi(agent_id)
  )
  with check (
    current_niveau_acces() = 'admin'
    and est_membre_de_garde(garde_id)
  );
