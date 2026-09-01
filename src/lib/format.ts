import type { CreneauType, PosteVehicule, Vehicule } from './types';

interface HasHoraire {
  creneau_type_id: string | null;
  heure_debut_perso: string | null;
  heure_fin_perso: string | null;
}

export function formatHoraire(entity: HasHoraire, creneaux: CreneauType[]): string {
  if (entity.creneau_type_id) {
    const c = creneaux.find((x) => x.id === entity.creneau_type_id);
    if (c) return `${c.nom} · ${c.heure_debut}–${c.heure_fin}`;
  }
  if (entity.heure_debut_perso && entity.heure_fin_perso) {
    return `${entity.heure_debut_perso}–${entity.heure_fin_perso}`;
  }
  return 'horaire non précisé';
}

export function buildPosteVehiculeLookup(postes: PosteVehicule[], vehicules: Vehicule[]) {
  const posteToVehicule = new Map(postes.map((p) => [p.id, p.vehicule_id]));
  const posteToNom = new Map(postes.map((p) => [p.id, p.nom_poste]));
  const vehiculeNom = new Map(vehicules.map((v) => [v.id, v.nom]));

  return {
    vehiculeNomForPoste(posteId: string): string {
      const vehiculeId = posteToVehicule.get(posteId);
      return vehiculeId ? vehiculeNom.get(vehiculeId) ?? '—' : '—';
    },
    posteNom(posteId: string): string {
      return posteToNom.get(posteId) ?? '—';
    },
  };
}
