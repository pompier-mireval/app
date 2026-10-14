// Petit cache mémoire pour les données de référence (véhicules, postes,
// compétences, agents, gardes…) relues à chaque changement de page.
// - Durée de vie courte : un changement fait par quelqu'un d'autre apparaît
//   au plus tard après TTL_MS.
// - Vidé dès que CE navigateur écrit en base (voir supabaseClient.ts) et à
//   chaque changement d'utilisateur : les données sont filtrées par RLS.
// - Les requêtes identiques simultanées sont fusionnées en une seule.
const TTL_MS = 90_000;

const store = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
let epoch = 0; // une réponse partie avant une invalidation n'est pas mise en cache

const copy = <T,>(value: T): T => (Array.isArray(value) ? ([...value] as unknown as T) : value);

export function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(copy(hit.value as T));

  let pending = inflight.get(key) as Promise<T> | undefined;
  if (!pending) {
    const startedAt = epoch;
    const p: Promise<T> = fetcher()
      .then((value) => {
        if (startedAt === epoch) store.set(key, { at: Date.now(), value });
        return value;
      })
      .finally(() => {
        if (inflight.get(key) === p) inflight.delete(key);
      });
    inflight.set(key, p);
    pending = p;
  }
  return pending.then(copy);
}

export function invalidateCache(): void {
  epoch++;
  store.clear();
  inflight.clear();
}
