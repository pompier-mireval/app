import type { CreneauType } from './types';

interface HasHoraire {
  creneau_type_id: string | null;
  heure_debut_perso: string | null;
  heure_fin_perso: string | null;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function resolveRange(entity: HasHoraire, creneaux: CreneauType[]): [number, number] | null {
  if (entity.creneau_type_id) {
    const c = creneaux.find((x) => x.id === entity.creneau_type_id);
    if (c) return [toMinutes(c.heure_debut), toMinutes(c.heure_fin)];
  }
  if (entity.heure_debut_perso && entity.heure_fin_perso) {
    return [toMinutes(entity.heure_debut_perso), toMinutes(entity.heure_fin_perso)];
  }
  return null;
}

// Deux créneaux se chevauchent si l'un commence avant que l'autre finisse,
// dans les deux sens. Gère aussi le cas des horaires de nuit qui passent
// minuit (fin < début) en les traitant comme s'étalant sur 24h de plus.
function overlaps(a: [number, number], b: [number, number]): boolean {
  const [aStart, aEndRaw] = a;
  const [bStart, bEndRaw] = b;
  const aEnd = aEndRaw <= aStart ? aEndRaw + 24 * 60 : aEndRaw;
  const bEnd = bEndRaw <= bStart ? bEndRaw + 24 * 60 : bEndRaw;
  return aStart < bEnd && bStart < aEnd;
}

// Retourne true si `candidat` chevauche l'une des dispos déjà existantes
// pour le même agent, le même jour.
export function hasOverlap(
  candidat: HasHoraire,
  existantes: HasHoraire[],
  creneaux: CreneauType[]
): boolean {
  const candidatRange = resolveRange(candidat, creneaux);
  if (!candidatRange) return false; // horaire non résolu : on ne bloque pas

  return existantes.some((e) => {
    const range = resolveRange(e, creneaux);
    return range !== null && overlaps(candidatRange, range);
  });
}
