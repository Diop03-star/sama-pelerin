# Page Pèlerins — cartes mobiles (tableau desktop / cartes mobile) — Design

**Date :** 2026-08-21
**Statut :** approuvé

## Objectif

Sur mobile, le tableau Pèlerins provoque un scroll horizontal et des colonnes coupées. Remplacer le tableau par des **cartes** empilées sur mobile, en conservant le tableau sur desktop. Réduire les informations affichées sur la carte : les informations secondaires restent dans la fiche détail.

## Comportement responsive

- **Desktop (`md+`)** : tableau conservé tel quel (Nom, Groupe, Téléphone, Dossier, Reste dû, Actions). Actions du tableau enrichies : Voir (fiche), Modifier (modale), Supprimer (confirmation) — cohérence avec les cartes.
- **Mobile (`<md`)** : tableau caché (`hidden md:block`), cartes empilées (`md:hidden`).

## Carte mobile — contenu

- **Priorité 1** : Nom Prénom (gras, primary) + badge Statut du dossier (à droite) ; Groupe dessous (avec icône).
- **Priorité 2** : Téléphone (mono) ; Date d'inscription (`date_inscription`, `toLocaleDateString('fr-FR')`).
- **Actions** :
  - **Voir** → `/details-du-pelerin/:id` (lien)
  - **Modifier** → modale préremplie (groupe, prénom, nom, téléphone, email, sexe) → `update` + invalidation
  - **⋮ Plus** → menu déroulant (état local par carte) → **Supprimer** → modal de confirmation → `delete` + invalidation

## Suppression (nouvelle)

Aucune suppression de pèlerin n'existe aujourd'hui. Ajout d'une mutation `delete().eq('id', id)` avec modal de confirmation (« Supprimer « Prénom Nom » ? Ses documents, plan de paiement et versements seront supprimés définitivement. »). Les FK sont en `on delete cascade` en base — aucun changement SQL.

## Fichiers

| Fichier | Changement |
|---|---|
| `src/pages/Pelerins.tsx` | États `enEdition`, `aSupprimer`, `menuOuvert` ; mutation sauver gère insert **et** update ; mutation supprimer ; bloc cartes mobile ; tableau `hidden md:block` ; actions desktop enrichies |
| `src/pages/Pelerins.test.tsx` | Nouveau : édition préremplie (update), suppression via ⋮ Plus (confirm → delete), rendu carte mobile |

## Vérification

1. `npx vitest run src/pages/Pelerins.test.tsx` → PASS.
2. `npm run test` → suite complète PASS (133 + nouveaux).
3. `npm run build` + `npm run lint` → OK.
4. Vérification live : vue mobile (< md) → cartes avec les 5 infos + 3 actions ; vue desktop → tableau enrichi.