import { createClient } from '@supabase/supabase-js';
import { invalidateCache } from './cache';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Erreur volontairement bruyante : mieux vaut planter au démarrage
  // que de laisser tourner un client mal configuré en silence.
  throw new Error(
    'Variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes. ' +
    'Copie .env.example en .env et renseigne les valeurs de ton projet Supabase.'
  );
}

// L'anon key n'est pas un secret : elle est conçue pour être exposée
// côté client. La sécurité réelle est assurée par les policies RLS
// définies en base — jamais par ce qui est caché ou non dans ce fichier.
// Pas encore de types générés (`Database`) : le client reste non typé pour
// l'instant côté tables, on type les retours manuellement dans src/api/*.
// Voir README pour générer les vrais types une fois le schéma stabilisé.
const client = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Toute écriture (insert / update / upsert / delete) vide le cache des
// données de référence, une fois la requête terminée — réussie ou non.
// Ainsi les pages qui rechargent après une modification lisent du frais,
// sans qu'il faille penser à invalider à la main dans chaque fonction.
const WRITES = new Set(['insert', 'update', 'upsert', 'delete']);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function track<T extends object>(builder: T): T {
  return new Proxy(builder, {
    get(target, prop) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = Reflect.get(target, prop, target) as any;
      if (prop === 'then' && typeof value === 'function') {
        return (onOk?: (r: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
          value.call(
            target,
            (r: unknown) => {
              invalidateCache();
              return onOk ? onOk(r) : r;
            },
            (e: unknown) => {
              invalidateCache();
              if (onErr) return onErr(e);
              throw e;
            }
          );
      }
      if (typeof value === 'function') {
        return (...args: unknown[]) => {
          const out = value.apply(target, args);
          return out && typeof out === 'object' && typeof out.then === 'function' ? track(out) : out;
        };
      }
      return value;
    },
  });
}

const rawFrom = client.from.bind(client);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(client as any).from = (table: string) => {
  const qb = rawFrom(table);
  return new Proxy(qb, {
    get(target, prop) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = Reflect.get(target, prop, target) as any;
      if (typeof prop === 'string' && WRITES.has(prop) && typeof value === 'function') {
        return (...args: unknown[]) => track(value.apply(target, args));
      }
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
};

export const supabase = client;
