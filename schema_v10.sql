-- ============================================================
--  Migration v10 — à exécuter dans SQL Editor après schema_v9.sql
--  Ordre d'affichage des véhicules (page Véhicules et Planning).
-- ============================================================

alter table vehicules add column if not exists ordre int not null default 0;

-- Ordre initial = ordre alphabétique actuel
with numerotes as (
  select id, row_number() over (order by nom) as n from vehicules
)
update vehicules v set ordre = numerotes.n from numerotes where numerotes.id = v.id;
