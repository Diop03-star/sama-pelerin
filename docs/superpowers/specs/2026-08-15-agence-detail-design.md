# Design — Page détails d'agence (superadmin)

Date : 2026-08-15

## Objectif

Permettre au superadmin de consulter le détail d'une agence depuis une page dédiée, et rendre les agences cliquables depuis la Vue d'ensemble et la page Agences.

## Approche retenue

Réutiliser le RPC `stats_globales()` existant et filtrer côté client sur `agence_id`. Aucun changement SQL.

## Conception

### Nouvelle page `src/pages/SuperAdminAgenceDetail.tsx`

- Route `/superadmin/agences/:id` (ajoutée dans `App.tsx` sous `SuperAdminLayout`).
- Deux queries React Query :
  - `['superadmin-agence', id]` : `supabase.rpc('stats_globales')` puis filtre `agence_id === id` → stats (type `StatsAgence`).
  - `['superadmin-agence-infos', id]` : `supabase.from('agences').select('*').eq('id', id).single()` → infos (type `Agence`).
- Contenu :
  - Breadcrumb « Agences › Détails » (pattern de `PelerinDetail.tsx`).
  - Titre : nom de l'agence + badge Active/Désactivée (`Badge`).
  - Carte infos : téléphone, email, adresse, créée le (`formatDate`).
  - Grille `StatCard` : Pèlerins, Dossiers valides · complets · incomplets, Groupes + places libres, Total encaissé (`formatFCFA`, total global sans filtre période), Retards, Rappels (attente / échec), Membres (gérants + agents).
- États : « Chargement… » pendant le chargement, « Agence introuvable. » si absente.

### Navigation cliquable

- `SuperAdminGlobal.tsx` : le nom de l'agence devient un `Link` vers `/superadmin/agences/${s.agence_id}` avec style hover `text-primary underline`.
- `SuperAdminAgences.tsx` : idem sur le nom de l'agence.

### Tests

- Nouveau `src/pages/SuperAdminAgenceDetail.test.tsx` (mock `supabase.rpc` + `from`, conventions de `SuperAdminGlobal.test.tsx`) :
  - Affiche les infos et les stats de l'agence.
  - Affiche le badge Désactivée pour une agence inactive.
  - Affiche « Agence introuvable. » quand l'id ne correspond à aucune agence.
- Vérifications : `npm run lint`, `npm test`, `npm run build`.

## Fichiers touchés

| Fichier | Action |
|---|---|
| `src/pages/SuperAdminAgenceDetail.tsx` | Nouveau |
| `src/pages/SuperAdminAgenceDetail.test.tsx` | Nouveau |
| `src/App.tsx` | Route ajoutée |
| `src/pages/SuperAdminGlobal.tsx` | Nom cliquable |
| `src/pages/SuperAdminAgences.tsx` | Nom cliquable |

Aucun changement SQL.