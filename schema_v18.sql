-- v18 : points de vérification du FPTL
--   - ajoute l'avertisseur sonore de recul
--   - renumérote les points dans un ordre logique (avant -> arrière, puis commandes, puis radio)
-- Rejouable sans doublon : les points existants (même nom) sont seulement remis en ordre.

with liste(zone, nom, ordre) as (
  values
    ('États du véhicule', 'Gyrophare', 1),
    ('États du véhicule', 'Feu de pénétration', 2),
    ('États du véhicule', 'Feu de position', 3),
    ('États du véhicule', 'Feu de croisement', 4),
    ('États du véhicule', 'Feu de route', 5),
    ('États du véhicule', 'Feu de brouillard avant', 6),
    ('États du véhicule', 'Clignotant gauche', 7),
    ('États du véhicule', 'Clignotant droit', 8),
    ('États du véhicule', 'Feu de détresse', 9),
    ('États du véhicule', 'Feu de freinage', 10),
    ('États du véhicule', 'Feu de plaque', 11),
    ('États du véhicule', 'Feu de brouillard arrière', 12),
    ('États du véhicule', 'Feu de recul', 13),
    ('États du véhicule', 'Avertisseur sonore de recul', 14),
    ('États du véhicule', 'Klaxon', 15),
    ('États du véhicule', 'Rétroviseur', 16),
    ('États du véhicule', 'Essuie glaces', 17),
    ('Radio', '1 tph 900', 18),
    ('Radio', '1 poste fixe antares', 19)
),
maj as (
  update inventaire_items i
     set zone = l.zone, ordre = l.ordre
    from liste l, vehicules v
   where v.nom = 'FPTL'
     and i.vehicule_id = v.id
     and i.famille = 'verification'
     and i.nom = l.nom
  returning i.nom
)
insert into inventaire_items (famille, vehicule_id, zone, nom, quantite, ordre)
select 'verification', v.id, l.zone, l.nom, 1, l.ordre
  from vehicules v
 cross join liste l
 where v.nom = 'FPTL'
   and not exists (
     select 1 from inventaire_items i
      where i.vehicule_id = v.id and i.famille = 'verification' and i.nom = l.nom
   );
