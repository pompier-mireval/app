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

export interface Horaire {
  debut: string;
  fin: string;
}

export function getHoraire(entity: HasHoraire, creneaux: CreneauType[]): Horaire | null {
  if (entity.creneau_type_id) {
    const c = creneaux.find((x) => x.id === entity.creneau_type_id);
    if (c) return { debut: c.heure_debut, fin: c.heure_fin };
  }
  if (entity.heure_debut_perso && entity.heure_fin_perso) {
    return { debut: entity.heure_debut_perso, fin: entity.heure_fin_perso };
  }
  return null;
}

// Un horaire qui traverse minuit (ex : 19:00–07:00) est une garde de nuit ;
// les entités sans horaire précisé sont classées "jour" par défaut.
export function isHoraireNuit(entity: HasHoraire, creneaux: CreneauType[]): boolean {
  const h = getHoraire(entity, creneaux);
  return h !== null && h.debut > h.fin;
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
