# Spec — Dossiers pèlerins simplifiés (validé / incomplet) et page Documents ligne-par-pèlerin

Date : 2026-08-18
Projet : Hajj Management
Statut : validée (brainstorming)

## Contexte

Le statut de dossier actuel a 3 états (`incomplet` / `complet` / `valide`) avec une règle trop permissive : « complet » dès que tous les documents sont soumis ou validés. La page Gestion des documents liste une ligne par document, avec des statuts fins (manquant/soumis/valide/rejete), un grand panneau « Valider sans fichier », et des cartes comptant les documents.

## Règle métier

Un dossier de pèlerin est **validé** si et seulement si les **4 types requis** — Passeport, Visa, Certificat de vaccination, Photo d'identité — ont chacun un document dont le statut est `valide`. Sinon le dossier est **incomplet**.

- Le type « Autre » ne compte pas pour le statut du dossier.
- L'état `complet` est supprimé partout (base, lib, UI, stats).
- Toute autre combinaison (soumis, rejeté, manquant, absent) rend le dossier `incomplet`.

## Changements

### 1. Base de données (`supabase/schema.sql` + SQL live)

- `pelerins.statut_dossier` : contrainte check `in ('incomplet','valide')`, défaut `incomplet`.
- `trg_maj_statut_dossier()` : recalcul du statut — `valide` si les 4 types requis ont tous un document `valide`, sinon `incomplet` (ne considère que les 4 types requis ; ignore « autre »).
- `stats_globales()` : suppression de `dossiers_complets` (colonnes et agrégats) ; seuls `dossiers_valides` et `dossiers_incomplets` restent.
- SQL live fourni à l'utilisateur (SQL editor Supabase) : ALTER de la contrainte, remplacement du trigger, remplacement de `stats_globales()`, backfill des dossiers existants (`complet` → recalculé `valide`/`incomplet` selon la règle).

### 2. Lib

- `src/lib/types.ts` : `StatutDossier = 'incomplet' | 'valide'` ; `StatsAgence` sans `dossiers_complets`.
- `src/lib/plan.ts` : `statutDossierDepuisDocuments(statuts: string[])` → `'incomplet' | 'valide'` (tous `valide` → `valide`, sinon `incomplet` ; liste vide → `incomplet`).
- `src/lib/format.ts` : `LIBELLES_DOSSIER` et `TONE_DOSSIER` sans la clé `complet`.
- Tests `plan.test.ts` adaptés.

### 3. Page Gestion des documents (`src/pages/Documents.tsx`)

- Suppression du panneau « Valider sans fichier » (select pèlerin, type, date, n°, bouton).
- Tableau : **une ligne par pèlerin** — colonnes : Pèlerin (nom + téléphone, lien vers `/details-du-pelerin/:id`), Statut.
- Statut affiché selon le filtre type :
  - « Tous les types » : **Validé** (dossier) ou **Incomplet** (dossier) — badge `TONE_DOSSIER` / `LIBELLES_DOSSIER`.
  - Type précis : **Validé** (document `valide`) ou **Manquant** (tout autre cas) — badge rouge/vert dédié (réutilise `TONE_DOCUMENT`/`LIBELLES_DOC_STATUT`).
- Filtres conservés : **Type** (Tous les types + les 5 types) et **Statut** (Tous les statuts / Validé / Incomplet / Manquant).
  - L'option « Manquant » n'est pertinente qu'avec un type précis.
  - Le paramètre d'URL `alerte=passeport` (dashboard) continue d'activer le filtre type Passeport.
- Cartes en haut : **Total Pèlerins** / **Dossiers validés** / **Dossiers incomplets**.
- Les requêtes : `pelerins` (avec leurs documents groupés par type) au lieu de `documents`.
- La gestion fine des documents (téléverser, valider, rejeter, modifier, supprimer) reste dans la fiche pèlerin (`DocumentSection`, inchangée).

### 4. Pages connexes

- `src/pages/Pelerins.tsx` : retrait de l'option « Complet » du filtre statut (reste Validé / Incomplet).
- `src/pages/SuperAdminGlobal.tsx` et `src/pages/SuperAdminAgenceDetail.tsx` : retrait de l'affichage « X complets ».
- `Dashboard.tsx` : inchangé (filtre `statut_dossier = 'incomplet'` déjà utilisé).

### 5. Tests

- `Documents.test.tsx` : réécrit pour le tableau ligne-par-pèlerin (statut validé/incomplet tous types ; validé/manquant par type ; filtres type+statut ; cartes).
- `Pelerins.test.tsx` (filtre), `plan.test.ts` (fonction), `SuperAdminGlobal.test.tsx` et `SuperAdminAgenceDetail.test.tsx` (sans `dossiers_complets`) adaptés.

## Hors périmètre

- `DocumentSection` (fiche pèlerin) : aucun changement.
- Workflow d'upload/validation par document : inchangé.
- Rappels (documents) : inchangés.

## Dépendance

Migration SQL live à exécuter par l'utilisateur dans le SQL editor Supabase (fournie en fin d'implémentation, comme la refonte paiement).
