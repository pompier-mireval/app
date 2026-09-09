-- ============================================================
--  Passe bastien.tiffy@sdis34.fr en superadmin
--  À exécuter dans le SQL Editor Supabase.
--
--  Plusieurs triggers protègent la colonne niveau_acces (au moins
--  trg_protect_agent_privileged_fields défini dans security_rls.sql, et un
--  autre via protect_niveau_acces() qui vient d'un schema.sql absent de ce
--  repo). Tous s'appuient sur auth.uid(), NULL dans le SQL Editor (pas de
--  session utilisateur) : ils bloquent donc même un admin ici.
--  On désactive tous les triggers "utilisateur" de la table le temps de
--  l'update (ça n'affecte pas les contraintes internes de Postgres comme
--  les clés étrangères), puis on les réactive.
-- ============================================================

alter table agents disable trigger user;

update agents
set niveau_acces = 'superadmin'
where email = 'bastien.tiffy@sdis34.fr';

alter table agents enable trigger user;

-- Vérification
select id, email, nom, prenom, niveau_acces, auth_user_id
from agents
where email = 'bastien.tiffy@sdis34.fr';
