# Design — Page Superadmin (vue globale multi-agences)

**Date** : 2026-08-14
**Statut** : validé par l'utilisateur

## Objectif

Offrir au SaaS « Stitch Sama Pèlerin » une vue superadmin : vue globale des
indicateurs de toutes les agences + gestion des agences (création d'une
agence avec son compte gérant, désactivation/réactivation avec blocage
complet de l'accès).

## Décisions validées

1. **Périmètre** : vue globale (lecture) + gestion des agences. Pas d'accès
   en profondeur aux données d'une agence, pas de gestion des membres.
2. **Indicateurs de la vue globale** : pèlerins et dossiers, finances /
   paiements, groupes, membres, rappels.
3. **Authentification** : nouveau rôle `superadmin` dans `utilisateurs`
   (sans agence rattachée), même page de connexion, redirection par rôle.
4. **Désactivation d'une agence** : bloque l'accès complet (données + app)
   via RLS ; réactivable par le superadmin.
5. **Création d'une agence** : agence + ligne `utilisateurs` gérant
   pré-créée (`user_id` null) ; le gérant s'inscrit avec son email et son
   compte se lie automatiquement (mécanisme `handle_new_user` existant).
6. **Couche de données de la vue globale** : RPC SQL `stats_globales()`
   (security definer) qui agrège par agence — aucune donnée brute ne
   circule côté client.
7. **Exception aux contraintes** : `src/lib/types.ts` est modifié
   (extension `Role`, `Agence.active`, type `StatsAgence`) —
   indispensable à la feature, limité à ces ajouts. `supabase/schema.sql`
   est mis à jour comme référence du schéma.

## Architecture

### SQL (appliqué sur Supabase via SQL Editor + référence `schema.sql`)

- `utilisateurs.role` : check → `('gerant','agent','superadmin')`
- `agences.active boolean not null default true`
- Fonction `public.is_superadmin()` (language sql, stable) :
  `exists(select 1 from utilisateurs where user_id = auth.uid() and role='superadmin')`
- Fonction `current_agence_id()` modifiée : retourne `NULL` si l'agence du
  membre est inactive → toutes les policies RLS refusent → blocage total
  (mécanisme de désactivation, réversible)
- 11 policies `*_superadmin` : `or is_superadmin()` sur le SELECT des
  tables `groupes`, `pelerins`, `documents`, `plans_paiement`, `tranches`,
  `paiements`, `rappels` ; sur `agences` (select + update) ; sur
  `utilisateurs` (select + insert — création du compte gérant)
- RPC `stats_globales()` (language sql, security definer, stable) : une
  ligne par agence :
  `agence_id, agence_nom, agence_active, pelerins_total,
  dossiers_valides, dossiers_complets, dossiers_incomplets,
  groupes_total, places_restantes, gerants, agents,
  encaissements_total, encaissements_30j, tranches_en_retard,
  rappels_attente, rappels_echec`

### Front

- **`src/components/layout/SuperAdminLayout.tsx`** (nouveau) : sidebar
  dédiée (Vue d'ensemble `/superadmin`, Agences `/superadmin/agences`,
  Déconnexion) + topbar « Superadmin ». N'utilise **pas** `useAgence()`.
- **`src/components/layout/AppLayout.tsx`** :
  - si `profil.role === 'superadmin'` → `<Navigate to="/superadmin">`
    (avant le check `agence_id`)
  - si `agence?.active === false` → écran « Agence désactivée »
- **`src/App.tsx`** : routes `/superadmin` et `/superadmin/agences` sous
  `SuperAdminLayout` (lui-même sous `ProtectedRoute`). `SuperAdminLayout`
  redirige les non-superadmin vers `/tableau-de-bord`.
- **`src/pages/SuperAdminGlobal.tsx`** : `useQuery(['superadmin-stats'])`
  → `supabase.rpc('stats_globales')` → StatCards globales (pèlerins,
  dossiers valides, encaissements 30 j, rappels en attente, agences
  actives) + tableau par agence.
- **`src/pages/SuperAdminAgences.tsx`** : liste des agences, Modal
  « Créer une agence » (nom, téléphone, email, adresse + nom et email du
  gérant) → insert `agences` puis insert `utilisateurs` (role `gerant`,
  `user_id` null) ; toggle désactiver/réactiver avec confirmation.

### Flux de création d'une agence

1. Superadmin remplit le formulaire.
2. `insert agences` → récupération de l'id.
3. `insert utilisateurs` (agence_id, nom, email, role `gerant`, user_id
   null, telephone '').
4. Le gérant s'inscrit avec son email (Confirm email désactivé) ;
   `handle_new_user` lie la ligne par email (mécanisme existant).

### Flux de désactivation

1. Superadmin bascule `agences.active` → `false`.
2. `current_agence_id()` retourne NULL pour tous les membres → RLS refuse
   tout → aucune donnée.
3. `AppLayout` détecte `agence.active === false` → écran de blocage
   « Agence désactivée. Contactez votre administrateur. »
4. Réactivation : même bascule → `true`.

## Compte superadmin (création manuelle, une fois)

1. Inscription via l'app avec un email dédié (devient agent sans agence).
2. SQL Editor : `update public.utilisateurs set role='superadmin' where
   email='<email>';`

## Vérification

- Tests Vitest (mock `@supabase/supabase-js` + `QueryClient` +
  `MemoryRouter`) : redirection superadmin, garde agence désactivée,
  rendu de la vue globale (fixture `rpc`), création d'agence (2 inserts),
  toggle désactivation.
- Vérification réelle en Chrome headless : connexion superadmin, vue
  globale, création d'une agence test, désactivation → blocage membre.

## Périmètre exclu (YAGNI)

- Pas d'accès détaillé aux données d'une agence (pèlerins, groupes…).
- Pas de gestion des membres/groupes/pèlerins par le superadmin.
- Pas de période/filtres sur les finances (totaux cumulés + 30 jours).