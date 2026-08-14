# Design — Filtre de période sur le total encaissé

Date : 2026-08-14
Statut : validé par l'utilisateur

## Problème

1. Le « Total encaissé » du tableau de bord (gérant) et la carte « Encaissés (30 j) » (superadmin) affichent des montants sans possibilité de filtrer par période.
2. Les montants longs (ex. `5 120 000 000 FCFA`) débordent ou passent à la ligne dans les StatCards `grande` (`text-display-lg`).

## Décisions validées

- Filtre appliqué sur le **dashboard gérant** (`src/pages/Dashboard.tsx`) ET la **vue superadmin** (`src/pages/SuperAdminGlobal.tsx`).
- Périodes **glissantes**, défaut **Année** :
  - `jour` : aujourd'hui à 00:00 → maintenant
  - `semaine` : maintenant − 7 jours
  - `mois` : 1er du mois à 00:00
  - `annee` : 1er janvier à 00:00
- Rendu montant : **nombre compact + unité petite** — `whitespace-nowrap tabular-nums`, « FCFA » en petit (découpe du suffixe de `formatFCFA`), taille `headline-lg` au lieu de `display-lg` quand `grande`.
- Le filtre ne porte **que** sur le montant encaissé : les autres StatCards, le bloc « Progression financière » et « Attendu/Reste » restent globaux (saison).
- Superadmin : **zéro changement SQL** — calcul client via une requête `paiements` filtrée (agence_id par embedding `tranche:plans_paiement:pelerin(agence_id)`, RLS protège déjà par agence). La RPC `stats_globales` reste inchangée.
- Renommage : « Encaissés (30 j) » → « Total encaissé » (superadmin).

## Architecture

### `src/lib/dates.ts` (nouveau)
- `export type Periode = 'jour' | 'semaine' | 'mois' | 'annee'`
- `export const LIBELLES_PERIODE: Record<Periode, string>` → « Jour / Semaine / Mois / Année »
- `export function debutPeriode(p: Periode): Date` — début de période selon la règle ci-dessus.
- `export function nomPeriode(p: Periode, n: number): string` — libellé de la valeur filtrée (ex. « aujourd'hui », « 7 derniers jours », « ce mois-ci », « cette année ») pour la tendance de la StatCard.

### `src/components/ui/FiltrePeriode.tsx` (nouveau)
- Props : `periode: Periode`, `onChange: (p: Periode) => void`.
- 4 boutons segmentés (Jour/Semaine/Mois/Année) ; actif = `bg-primary text-on-primary`, inactif = `text-on-surface-variant hover:bg-surface-container-low`.
- Test : `FiltrePeriode.test.tsx` (rendu des 4 boutons, bouton actif, clic → `onChange`).

### `src/components/ui/StatCard.tsx` (modifié, compat rétro)
- Nouvelle prop `actions?: ReactNode` — slot dans l'en-tête de la carte.
- Nouvelle prop `monetaire?: boolean` — si `true` :
  - la valeur est rendue en `whitespace-nowrap tabular-nums` ;
  - si `grande`, taille `text-headline-lg` au lieu de `text-display-lg` ;
  - unité « FCFA » en `text-headline-md text-on-surface-variant` (découpe du suffixe ` FCFA` de `formatFCFA(valeur)`).
- Aucun usage existant ne change (props optionnelles).
- Test : `StatCard.test.tsx` (rendu monetaire : une ligne, unité en petit ; slot `actions` rendu).

### `src/pages/Dashboard.tsx` (modifié)
- État local `periode` (défaut `'annee'`).
- Query `dashboard-encaissements` → renvoie désormais `paiements` filtrés :
  ```ts
  queryKey: ['dashboard-encaissements', periode]
  supabase.from('paiements').select('montant_paye').gte('date_paiement', debutPeriode(periode).toISOString())
  ```
  `totalPaye` = somme des `montant_paye`.
- `totalAttendu` reste issu de la requête `plans_paiement` (saison, inchangée) ; `resteGlobal`/`progression` restent globaux.
- StatCard « Total encaissé » : `valeur={totalPaye}`, `monetaire`, `actions={<FiltrePeriode .../>}`, tendance `nomPeriode(...)` (positif).

### `src/pages/SuperAdminGlobal.tsx` (modifié)
- État local `periode` (défaut `'annee'`).
- Nouvelle query `superadmin-encaissements` :
  ```ts
  queryKey: ['superadmin-encaissements', periode]
  supabase.from('paiements').select('montant_paye, tranche:plans_paiement(pelerin:pelerins(agence_id))')
    .gte('date_paiement', debutPeriode(periode).toISOString())
  ```
  → agrégation par agence (`Map<agence_id, total>`) et total global.
- La StatCard « Encaissés (30 j) » devient « Total encaissé » (valeur = total filtré, `monetaire`, `actions` = filtre).
- Le tableau : colonne « ENCAISSÉ » affiche le total filtré par agence (remplace `encaissements_total` de la RPC). `encaissements_total`/`encaissements_30j` restent dans le type `StatsAgence` (non affichés).
- Tests existants mis à jour : mock de la requête paiements filtrée, libellé « Total encaissé ».

## Erreurs / cas limites

- Période sans paiement → montant 0, tendance toujours rendue (positif).
- Paiements hors période exclus côté serveur (`.gte`), aucune logique client de tri.
- Volumes faibles (SAAS) : une requête par période, sans pagination.
- `formatFCFA(0)` → « 0 FCFA » (rendu compact inchangé).

## Tests & vérification

- Vitest : `FiltrePeriode.test.tsx`, `StatCard.test.tsx`, mise à jour `SuperAdminGlobal.test.tsx` (2 tests).
- Build + lint (warning préexistant uniquement).
- Vérification headless : login gérant → filtre Jour ≈ 0 (paiements antérieurs), Semaine = paiements des 7 derniers jours, Année = total ; superadmin → total + colonne tableau suivent le filtre ; aucun débordement de ligne sur « Total encaissé » avec un gros montant.