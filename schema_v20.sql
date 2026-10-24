-- Création de compte (Edge Function create-agent, auth.admin.createUser) :
-- le trigger handle_new_auth_user rattache auth_user_id à la fiche agent,
-- mais protect_agent_privileged_fields refusait toute modification de
-- auth_user_id, ce qui faisait échouer la création (« Database error
-- creating new user »). Le rattachement initial (null -> id) est désormais
-- autorisé hors session utilisateur (auth.uid() null : trigger, service role) ;
-- tout autre changement reste interdit.
create or replace function protect_agent_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.auth_user_id is distinct from old.auth_user_id
     and not (old.auth_user_id is null and auth.uid() is null) then
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
