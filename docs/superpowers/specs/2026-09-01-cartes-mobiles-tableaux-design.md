# Tableaux → Cartes Mobiles (Paiements, Groupes, Membres) — Design

**Date :** 2026-09-01
**Statut :** approuvé

## Objectif

Sur mobile, les pages Paiements & échéanciers, Groupes et Membres affichent leurs tableaux en format desktop (scroll horizontal, boutons d'action invisibles). Remplacer ces tableaux par des listes de cartes sur mobile (`< md`), en réutilisant le pattern existant de la page Pèlerins (`src/pages/Pelerins.tsx:198-316` : tableau `hidden md:block` + cartes `md:hidden`).

## Portée

| Fichier | Changement |
|---|---|
| `src/pages/Paiements.tsx` | 2 tableaux (plans, tranches) → wrapper `hidden md:block` + listes de cartes `md:hidden` |
| `src/pages/Groupes.tsx` | 1 tableau (groupes) → wrapper `hidden md:block` + cartes `md:hidden` avec actions visibles |
| `src/pages/Membres.tsx` | 2 tableaux (membres, invitations) → wrappers `hidden md:block` + cartes `md:hidden` avec actions visibles |
| `src/pages/Paiements.test.tsx` | Ajouter des assertions « carte mobile » |
| `src/pages/Groupes.test.tsx` | **Nouveau** — pattern de mock supabase existant |
| `src/pages/Membres.test.tsx` | **Nouveau** — pattern de mock supabase existant |

## Pattern commun

- Wrapper tableau : `hidden overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm md:block` (identique à `Pelerins.tsx:198`).
- Liste cartes : `<div className="space-y-4 md:hidden">` placée juste après le wrapper du tableau.
- Le `EmptyState` de chaque tableau est dupliqué dans la liste mobile (le tableau est caché sur mobile, son EmptyState ne serait pas visible).
- Les alertes, StatCards, filtres et modales existants restent inchangés.
- Aucun commentaire dans le code (convention repo), textes en français.

## Cartes par page

### Paiements — carte plan
- Ligne 1 : nom pèlerin (lien → `/details-du-pelerin/:id`, `font-semibold text-primary`) + badge `TONE_STATUT_PLAN`/`LIBELLES_STATUT_PLAN`.
- Ligne 2 : téléphone (`text-body-md text-on-surface-variant`).
- « Plan : {formatFCFA(montant_total)} · {nombre_tranches} tranches ».
- « Payé : {formatFCFA(paye)} » (`text-vert`) / « Reste : {formatFCFA(reste)} » (`text-error` si reste > 0, sinon `text-vert`).
- ProgressBar (`valeur=progression`, tone vert si 100 % sinon gold) + « {progression}% » (`text-data-mono`).
- Badge « {n} en retard » si `retard > 0` (tone rouge).
- Bouton « Voir » (lien) → fiche pèlerin.

### Paiements — carte tranche
- Ligne 1 : nom pèlerin + badge `TONE_TRANCHE`/`LIBELLES_TRANCHE`.
- « Tranche {numero_tranche} · {formatFCFA(montant_prevu)} ».
- « Échéance : {formatDate(date_echeance)} ».

### Groupes — carte groupe
- Ligne 1 : nom (lien → `/liste-des-pelerins?groupe=:id`, `font-semibold text-primary`) + badge Hajj/Omra.
- « Départ : {formatDate} » / « Retour : {formatDate} ».
- « Places : {inscrits} / {nb_places_max} » (`text-error font-semibold` si complet et > 0).
- Boutons **Modifier** (`ouvrirEdition`) et **Supprimer** (`supprimer.mutate`) visibles en permanence (icons `edit`/`delete`, classes `rounded-lg p-2 text-on-surface-variant hover:bg-surface-container`).

### Membres — carte membre
- Ligne 1 : nom + badge rôle (Gérant ambre / Agent neutre).
- Email (`text-body-md text-on-surface-variant`).
- Bouton **Retirer** (icon `delete`, hover `text-error`) visible, uniquement si `m.user_id !== profil?.user_id`.

### Membres — carte invitation
- Ligne 1 : email + badge rôle.
- « Expire le : {toLocaleDateString fr-FR} ».
- Bouton **Annuler** (icon `close`, hover `text-error`) visible.

## Tests

- `Paiements.test.tsx` : nouveau test « affiche les cartes mobiles » — après rendu, `screen.getByText('Fatou Sy')` visible, montants (`formatFCFA`), badges présents. Les assertions existantes ne sont pas modifiées.
- `Groupes.test.tsx` (nouveau) : mock `supabase.from` pour `groupes` (select → order) ; tests : affiche les cartes mobiles (nom, type, dates, places), boutons Modifier/Supprimer présents, état vide.
- `Membres.test.tsx` (nouveau) : mocks `supabase.from` pour `utilisateurs` et `invitations` + `useProfil` ; tests : cartes membres (nom, email, rôle), bouton Retirer absent pour soi-même, cartes invitations (email, expire), état vide.
- Vérification : `npm run test` (suite complète PASS), `npm run lint` 0 erreur, `npm run build` OK.

## Hors périmètre

- Page Pèlerins (déjà conforme), SuperAdmin, Détails pèlerin, tableaux du Dashboard.
- Aucune modification des données, requêtes, RLS, ni logique métier.