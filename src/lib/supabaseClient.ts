import { createClient } from '@supabase/supabase-js';

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
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
