-- ============================================================
--  Migration v3 — à exécuter dans SQL Editor après schema_v2.sql
--  Sépare la garde de service en 3 créneaux indépendants par semaine :
--    - 'jour'    Lundi-Vendredi journée — fixe, ne tourne pas
--    - 'nuit'    Lundi-Jeudi nuit — tourne (ex. tous les 28 jours)
--    - 'weekend' Vendredi nuit-Dimanche nuit — tourne (ex. tous les 28 jours)
--  Avant cette migration, une seule ligne par semaine_debut mélangeait ces
--  notions (voir schema_v2.sql) ; on ne peut plus dire quelle garde couvre
--  la journée vs la nuit sur un même bloc "semaine".
-- ============================================================

alter table garde_semaines add column type text;

-- Reprise des lignes existantes : un bloc ancré sur un vendredi ne peut
-- être que le week-end (voir gardeBlocOf côté app) ; tout le reste
-- (ancré sur un lundi) était jusqu'ici utilisé comme la garde de nuit.
update garde_semaines
set type = case when extract(dow from semaine_debut) = 5 then 'weekend' else 'nuit' end
where type is null;

alter table garde_semaines alter column type set not null;
alter table garde_semaines add constraint garde_semaines_type_check
  check (type in ('jour', 'nuit', 'weekend'));

-- Une seule garde par semaine ET par créneau, plus une seule par semaine.
alter table garde_semaines drop constraint if exists garde_semaines_semaine_debut_key;
alter table garde_semaines add constraint garde_semaines_semaine_debut_type_key
  unique (semaine_debut, type);

-- Les policies RLS existantes (schema_v2.sql) ne référencent aucune
-- colonne précise : elles s'appliquent sans changement à la table mise à jour.
