# Design — Améliorations de la landing page SamaPèlerin

Date : 2026-09-09
Statut : approuvé (utilisateur)

## Contexte

Retour utilisateur sur la landing (`src/pages/Landing.tsx`) :

1. Preuve sociale trop maigre : « Agence pilote 3 » sonne comme un placeholder et casse la crédibilité des deux vrais témoignages.
2. Contraste visuel monotone : sections alternant blanc/gris clair, peu de respiration.
3. Aucune mention de sécurité des données alors que l'outil gère passeports, visas et paiements.
4. Tarif dégressif (« Dès 100 pèlerins : 1 000 FCFA ») quasi invisible en bas de la carte tarifaire.
5. Section Tutoriels vide en aperçu quand aucun tuto n'est publié en base : le bouton « Voir tous les tutoriels » seul donne l'impression d'une fonctionnalité non prête.

## Décisions (validées avec l'utilisateur)

- Preuve sociale : garder uniquement les 2 témoignages réels (« Al Hidjah Travel », « Voyages Al-Barakah »), supprimer « Agence pilote 3 ».
- Sécurité : affirmations génériques et prudentes, vraies avec la stack Supabase (HTTPS, hébergement sécurisé, cloisonnement par agence). Pas de mention RGPD.
- Tutoriels : 3 cartes d'exemple statiques (badge « Aperçu », miniature stylisée, titre d'exemple) quand la base est vide.

## Modifications

### 1. Témoignages — 2 réels seulement

- `TEMOIGNAGES` réduit à 2 entrées ; grille `md:grid-cols-2` au lieu de 3.
- Ajout d'un bandeau contextuel au-dessus de la grille : « Agences pilotes — Dakar » (petit label, fond or doux).

### 2. Rythme visuel

Nouvelle séquence de fonds :

| Section | Fond actuel | Fond cible |
|---|---|---|
| Hero | surface | surface (inchangé) |
| Avantages | surface-container-low | surface-container-low (inchangé) |
| Tarifs | surface | **primary (navy)** |
| Tutoriels | surface-container-low | **surface (blanc)** |
| Témoignages | surface | surface-container-low (gris) |
| Sécurité (nouvelle) | — | **secondary-container/40 (or doux)** |
| Contact | primary | primary (inchangé) |

La section tarifs en navy devient l'ancrage visuel central ; la bande or casse la fin de page.

### 3. Section sécurité (nouvelle bande)

Placée entre Témoignages et Contact. Titre : « Vos données, prises au sérieux ». Trois items avec icônes Material Symbols :

- `lock` — « Chiffré en transit » : toutes les communications passent en HTTPS.
- `verified_user` — « Accès cloisonné » : chaque agence ne voit que ses propres données.
- `cloud_done` — « Hébergement sécurisé » : données sauvegardées et accessibles toute l'année, même hors saison.

Textes prudentiels, sans engagement réglementaire (pas de « RGPD »).

### 4. Section tarifs repensée (fond navy, 2 cartes)

- Fond `bg-primary`, titres/textes en `text-on-primary` / blanc.
- Grille `md:grid-cols-2` (max-w-4xl) :
  - Carte principale « À l'usage » : fond blanc (`bg-surface-container-lowest`), contenu inchangé (1 500 FCFA/pèlerin inscrit, traits tarif, CTA « Demander une démo »). Le bloc « Tarif dégressif » est retiré de cette carte.
  - Carte « Tarif dégressif » : fond or (`bg-secondary-fixed`), les 2 paliers en grand format (`text-display-lg`) :
    - « Dès 100 pèlerins » → **1 000 FCFA**
    - « Dès 300 pèlerins » → **750 FCFA**
    - Argument de closing : « Plus vous inscrivez de pèlerins, moins vous payez par pèlerin. »
- Sous-titre de section conservé (1 500 FCFA par pèlerin inscrit).

### 5. Aperçu tutoriels avec placeholders

- Quand `tutos.length === 0` : 3 cartes d'exemple statiques (`md:grid-cols-3`), chacune un `Link` vers `/tutoriels` :
  - miniature stylisée : dégradé navy/or, icône Material `play_circle` centrée, ratio `aspect-video` ;
  - badge « Aperçu » (petit label or) ;
  - titres d'exemple : « Créer votre agence et inviter vos agents », « Créer un plan de paiement », « Suivre les documents d'un pèlerin ».
- Quand des tutos actifs existent : comportement actuel conservé (`CarteTuto`), pas de placeholders.
- Les placeholders ne simulent pas de vrais liens YouTube : uniquement icônes et navigation vers la galerie.

## Fichiers touchés

- `src/pages/Landing.tsx` — toutes les modifications ci-dessus.
- `src/pages/Landing.test.tsx` — mise à jour des tests.

## Tests

Dans `Landing.test.tsx` :

1. Les 2 vrais témoignages s'affichent, « Agence pilote 3 » n'existe plus.
2. La bande sécurité affiche ses 3 items (« Chiffré en transit », « Accès cloisonné », « Hébergement sécurisé »).
3. Le tarif dégressif reste visible (« 1 000 FCFA », « 750 FCFA ») et l'argument de closing apparaît.
4. Quand la requête tutos retourne un tableau vide : 3 cartes « Aperçu » rendues, chacune pointant vers `/tutoriels`.
5. Quand au moins un tuto existe : pas de cartes « Aperçu », cartes `CarteTuto` rendues.

## Hors scope

- Aucun nouveau fichier ni nouvelle dépendance.
- Pas de vraies miniatures YouTube pour les placeholders.
- Pas de modification du routing, de la vitrine `/tutoriels` ou des données Supabase.
