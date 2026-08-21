# Modèle économique « À l'usage : par pèlerin » — Design

**Date :** 2026-08-21
**Statut :** approuvé

## Objectif

Remplacer la grille tarifaire mensuelle fixe (Base 15 000 / Avancé 35 000 / Premium 75 000 FCFA/mois) par un modèle proportionnel à l'activité : paiement par pèlerin inscrit, avec paliers dégressifs. Les agences Hajj/Omra ont une activité par pics (Hajj, Ramadan) : payer selon le volume réel, rien dans les creux.

## Modèle retenu

- **Prix : 1 500 FCFA par pèlerin inscrit** (facturation par campagne Hajj ou Omra)
- **Paliers dégressifs** :
  - Dès 100 pèlerins : 1 000 FCFA
  - Dès 300 pèlerins : 750 FCFA
- **Principes** : sans abonnement mensuel, facturation par campagne, rappels WhatsApp inclus, données accessibles hors période facturée.

## Portée (landing uniquement)

| Fichier | Changement |
|---|---|
| `src/pages/Landing.tsx` | Section Tarifs : remplacer les 3 cartes mensuelles par une carte unique « À l'usage » + paliers ; sous-titre mis à jour ; suppression de « Abonnement mensuel, sans engagement. Annuel : 2 mois offerts. » |
| `src/pages/Landing.test.tsx` | Assertion `35 000 FCFA` remplacée par les nouveaux montants (`1 500 FCFA`, `1 000 FCFA`, `750 FCFA`) |
| `docs/superpowers/specs/2026-08-21-tarifs-usage-design.md` | Ce document (référence pour le futur module de facturation) |

## Règles

- Format des montants : `1 500 FCFA` (espaces normales), cohérent avec le reste du site.
- CTA de la carte : « Demander une démo » (WhatsApp) — inchangé.
- Aucun autre changement de la landing, des routes ou de la logique métier.

## Vérification

1. `npx vitest run src/pages/Landing.test.tsx` → PASS (5 tests).
2. `npm run test` → suite complète PASS (132 tests + ajustement).
3. `npm run build` → build OK.
4. `npm run lint` → aucune nouvelle erreur.
5. Vérification live sur http://localhost:5173 : la section Tarifs affiche la carte unique + paliers.