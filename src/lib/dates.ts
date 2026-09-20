function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

// Formate un Date en YYYY-MM-DD en restant en heure LOCALE — toISOString()
// convertit en UTC, ce qui décale la date d'un jour dans les fuseaux
// horaires positifs (comme la France) : minuit heure locale devient la
// veille en UTC. C'est ce qui cassait la navigation "suivant".
function toIsoLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayIso(): string {
  return toIsoLocal(new Date());
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toIsoLocal(d);
}

export function daysAgo(n: number): string {
  return addDays(todayIso(), -n);
}

export function inDays(n: number): string {
  return addDays(todayIso(), n);
}

// Toujours le lundi de la semaine contenant la date donnée.
export function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay(); // 0 = dimanche
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toIsoLocal(d);
}

export function weekDaysFrom(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

// Toujours le vendredi de la semaine contenant la date donnée — le
// pendant "week-end" de mondayOf, utile pour ancrer une rotation de garde
// sur le vendredi (voir gardeBlocOf : le vendredi appartient au bloc
// week-end).
export function fridayOf(dateStr: string): string {
  return addDays(mondayOf(dateStr), 4);
}

export function dayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export function dayLabelLong(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });
}

// ---------- Blocs de garde : semaine (Lun 7h → Ven 19h) ou week-end (Ven 19h → Lun 7h) ----------
// La caserne ne fonctionne pas sur une semaine calendaire classique : le
// planning s'enchaîne sur ces deux blocs fixes, jamais affichés ensemble.

export type GardeBlocType = 'semaine' | 'weekend';

export interface GardeBloc {
  type: GardeBlocType;
  start: string; // lundi pour 'semaine', vendredi pour 'weekend'
}

// Bloc contenant la date donnée. Le vendredi appartient calendairement au
// bloc week-end (sa portion nuit) même si sa portion jour est encore
// affichée dans le bloc semaine précédent — voir gardeBlocDays.
export function gardeBlocOf(dateStr: string): GardeBloc {
  const monday = mondayOf(dateStr);
  const friday = addDays(monday, 4);
  return dateStr < friday ? { type: 'semaine', start: monday } : { type: 'weekend', start: friday };
}

export function nextGardeBloc(bloc: GardeBloc): GardeBloc {
  return bloc.type === 'semaine'
    ? { type: 'weekend', start: addDays(bloc.start, 4) }
    : { type: 'semaine', start: addDays(bloc.start, 3) };
}

export function prevGardeBloc(bloc: GardeBloc): GardeBloc {
  return bloc.type === 'semaine'
    ? { type: 'weekend', start: addDays(bloc.start, -3) }
    : { type: 'semaine', start: addDays(bloc.start, -4) };
}

// Bornes calendaires du bloc (pour les requêtes de plage).
export function gardeBlocEnd(bloc: GardeBloc): string {
  return addDays(bloc.start, bloc.type === 'semaine' ? 4 : 2);
}

// Tous les jours calendaires touchés par le bloc, jour et nuit confondus.
export function gardeBlocCalendarDays(bloc: GardeBloc): string[] {
  const length = bloc.type === 'semaine' ? 5 : 3;
  return Array.from({ length }, (_, i) => addDays(bloc.start, i));
}

// Jours à afficher en colonne pour le mode jour/nuit sélectionné : le
// vendredi n'a de portion nuit que dans le bloc week-end, et de portion
// jour que dans le bloc semaine.
export function gardeBlocDays(bloc: GardeBloc, mode: 'jour' | 'nuit'): string[] {
  const days = gardeBlocCalendarDays(bloc);
  if (bloc.type === 'semaine') return mode === 'nuit' ? days.slice(0, 4) : days;
  return mode === 'jour' ? days.slice(1) : days;
}

export function gardeBlocLabel(bloc: GardeBloc): string {
  return bloc.type === 'semaine'
    ? `Semaine du ${dayLabel(bloc.start)} 7h au ${dayLabel(gardeBlocEnd(bloc))} 19h`
    : `Week-end du ${dayLabel(bloc.start)} 19h au ${dayLabel(gardeBlocEnd(bloc) + 1)} 7h`;
}
