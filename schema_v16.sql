-- Véhicule exclu du planning : reste dans la liste des véhicules (contrôle,
-- inventaire…) mais n'apparaît plus dans le planning ni dans la génération
-- automatique.
alter table vehicules add column if not exists dans_planning boolean not null default true;
