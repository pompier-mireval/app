# Planning caserne — première ébauche

Reprend le design existant (tokens de couleur, typographie DM Sans/DM Mono,
structure topbar + sidebar + bottom nav) sur une base de code neuve, branchée
sur Supabase au lieu de Google Sheets.

## Démarrage

```bash
npm install
cp .env.example .env      # puis renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm run dev
```

Remplace aussi `public/logo.jpg` par le logo de la caserne (même fichier que
dans l'ancienne app, `Logo-SP-Mireval 1.jpg`).

## Organisation du code

```
src/
  api/          fonctions d'accès aux données, une par domaine métier
                (agents, competences, vehicules, gardes, creneaux, disponibilites)
  hooks/        useAuth (session + agent courant)
  components/
    auth/       écran de connexion, garde de route par rôle
    layout/     topbar, sidebar, bottom nav, coquille de page
    ui/         boutons, cartes, badges, bannières d'erreur
  pages/        une page par écran (Dispos, Agents, Véhicules)
  lib/          client Supabase + types partagés
  styles/       CSS découpé par thème (tokens, base, auth, layout, composants)
```

Volontairement, aucun fichier ne dépasse ~150 lignes : chaque table a son
propre module d'API, chaque écran sa propre page. Pour ajouter une
fonctionnalité future (habillement, mécanique, inventaire, révisions), il
suffit d'ajouter un nouveau fichier dans `api/` et `pages/` sans toucher au
reste.

## Sécurité — points essentiels

- **La clé anon Supabase n'est pas un secret.** Elle est faite pour être
  exposée côté client ; la vraie protection vient des *policies RLS* définies
  en base (voir `schema.sql`, `schema_v2.sql` et **`security_rls.sql`** — ce
  dernier active RLS sur toutes les tables et doit être exécuté dans le SQL
  Editor Supabase avant toute mise en production). Ne mets jamais la
  `service_role` key dans ce projet front-end.
- **`.env` est ignoré par git** (`.gitignore`). Ne commit jamais de fichier
  `.env` rempli.
- **`ProtectedRoute` n'est qu'un confort d'UX.** Elle évite d'afficher un
  écran inutile à quelqu'un qui n'a pas le rôle requis, mais elle ne protège
  rien : si quelqu'un contourne la route, la requête Supabase sous-jacente
  sera de toute façon rejetée par la policy RLS côté serveur. C'est cette
  policy qui est la vraie barrière.
- **Types générés** : pour remplacer le `Database = Record<string, unknown>`
  provisoire dans `lib/types.ts` par des types 100% synchronisés avec ta
  base, une fois le schéma stable, lance :
  ```bash
  npx supabase gen types typescript --project-id <ton-project-id> > src/lib/database.types.ts
  ```

## Prochaines étapes suggérées

- Générer les types Supabase officiels (commande ci-dessus)
- Page planning (affectations agents ↔ postes ↔ véhicules)
- Page gardes (création + affectation, superadmin)
- Formulaire de créneau personnalisé sur `DisposPage`
- Bascule vers Azure AD comme provider d'auth (à la place ou en plus du magic link email)
