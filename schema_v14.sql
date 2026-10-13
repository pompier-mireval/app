-- ============================================================
--  Migration v14 — à exécuter dans SQL Editor après schema_v13.sql
--  Page Vérification des véhicules : réutilise les tables de l'inventaire
--  avec une "famille" (inventaire | verification).
-- ============================================================

alter table inventaire_items     add column if not exists famille text not null default 'inventaire' check (famille in ('inventaire', 'verification'));
alter table inventaire_controles add column if not exists famille text not null default 'inventaire' check (famille in ('inventaire', 'verification'));
alter table inventaire_manques   add column if not exists famille text not null default 'inventaire' check (famille in ('inventaire', 'verification'));

-- Une vérification relève une "anomalie" (en plus de manquant / défectueux)
alter table inventaire_manques drop constraint if exists inventaire_manques_probleme_check;
alter table inventaire_manques add constraint inventaire_manques_probleme_check
  check (probleme in ('manquant', 'defectueux', 'anomalie'));

create index if not exists inventaire_items_famille_idx on inventaire_items (famille, vehicule_id);
