# Design : Confirmation avant suppression d'un membre ou annulation d'une invitation

Date : 2026-09-16

## Problème

Dans `src/pages/Membres.tsx`, les boutons « Retirer » (suppression d'un membre/agent) et « Annuler » (annulation d'une invitation en attente) déclenchent immédiatement la suppression, sans aucune confirmation. Un clic accidentel retire donc définitivement un membre de l'agence.

## Solution

Ajouter une modale de confirmation réutilisant le pattern existant de la page Pèlerins (`src/pages/Pelerins.tsx` : overlay plein écran + boutons « Annuler » / « Confirmer »).

### Composant

État local dans `Membres.tsx` :

```ts
type Confirmation = {
  type: 'membre' | 'invitation'
  id: string
  nom: string // nom du membre ou email de l'invitation
} | null
```

Une seule modale, rendue selon `confirmation`.

### Flux

1. Clic sur « Retirer » (desktop ligne 160 / mobile ligne 188) → `setConfirmation({type: 'membre', id, nom})`.
2. Clic sur « Annuler » une invitation (desktop ligne 223 / mobile ligne 247) → `setConfirmation({type: 'invitation', id, nom: email})`.
3. La modale s'ouvre avec le message approprié :
   - Membre : « Retirer [nom] de votre agence ? Cette action est définitive. »
   - Invitation : « Annuler l'invitation de [email] ? »
4. Bouton « Confirmer » → exécute la mutation existante (`supprimer` ou `supprimerInvitation`) puis ferme la modale.
5. Bouton « Annuler » / clic sur l'overlay → ferme la modale sans supprimer.

### Messages et accessibilité

- Titre : « Confirmer la suppression » pour un membre, « Confirmer l'annulation » pour une invitation.
- Le bouton de confirmation est en rouge (danger), le bouton d'annulation neutre.
- Aucune saisie obligatoire (pas de champ « tapez le nom ») — action réversible ou non critique au niveau du produit.

### Comportements inchangés

- Les mutations Supabase, les gardes RLS et la logique d'affichage des boutons restent identiques.
- La garde « on ne peut pas se retirer soi-même » reste en place.

### Tests

Mise à jour de `src/pages/Membres.test.tsx` :

- Le clic sur « Retirer » n'appelle plus `delete` directement : la modale apparaît.
- Après confirmation dans la modale, la mutation est appelée avec le bon id.
- Le clic sur « Annuler » de la modale n'appelle pas la mutation.
- Même scénario pour « Annuler » une invitation.

## Hors périmètre

- Purge du compte `auth.users` côté Supabase (déjà constatée comme lacune, mais distincte).
- Gestion de l'erreur FK `pelerins.enregistre_par` lors de la suppression d'un membre ayant enregistré des pèlerins (traitement d'erreur générique de la mutation conservé).
