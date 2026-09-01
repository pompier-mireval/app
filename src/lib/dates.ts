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

export function dayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export function dayLabelLong(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });
}

// ---------- Blocs de garde : Lundi-Jeudi ou Vendredi-Dimanche ----------
// La caserne ne fonctionne pas sur une semaine calendaire classique : les
// gardes s'enchaînent sur ces deux blocs fixes. On affiche toujours un
// seul bloc à la fois (jamais les deux ensemble).

export type BlocType = 'lundi_jeudi' | 'vendredi_dimanche';

export function defaultBlocType(dateStr: string): BlocType {
  const day = new Date(`${dateStr}T00:00:00`).getDay(); // 0 = dimanche
  return day === 0 || day === 5 || day === 6 ? 'vendredi_dimanche' : 'lundi_jeudi';
}

// Début du bloc (un lundi pour lundi_jeudi, un vendredi pour vendredi_dimanche)
export function blocStart(anchorDate: string, blocType: BlocType): string {
  const monday = mondayOf(anchorDate);
  return blocType === 'lundi_jeudi' ? monday : addDays(monday, 4);
}

export function blocDays(start: string, blocType: BlocType): string[] {
  const length = blocType === 'lundi_jeudi' ? 4 : 3;
  return Array.from({ length }, (_, i) => addDays(start, i));
}

export function blocTypeLabel(blocType: BlocType): string {
  return blocType === 'lundi_jeudi' ? 'Lundi – Jeudi' : 'Vendredi – Dimanche';
}

export function blocLabel(start: string, blocType: BlocType): string {
  const days = blocDays(start, blocType);
  return `${blocTypeLabel(blocType)} · du ${start} au ${days[days.length - 1]}`;
}
