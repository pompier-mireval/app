-- ============================================================
--  Migration v11 — à exécuter dans SQL Editor après schema_v10.sql
--  Ordre dans lequel la génération automatique remplit les véhicules
--  (indépendant de l'ordre d'affichage).
-- ============================================================

alter table vehicules add column if not exists ordre_generation int not null default 0;
update vehicules set ordre_generation = ordre where ordre_generation = 0;
