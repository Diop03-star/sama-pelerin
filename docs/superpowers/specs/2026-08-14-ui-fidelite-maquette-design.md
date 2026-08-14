# Design — Refonte UI/UX fidèle à la maquette

**Date** : 2026-08-14
**Statut** : Validé (approbation utilisateur, portage fidèle pixel près — approche A)
**Référence** : maquette extraite `maquette/` (6 écrans HTML + `pilgrim_management_system/DESIGN.md`, screenshots `screen.png` font foi au pixel près)

## 1. Objectif

L'utilisateur juge l'UI/UX actuelle « complètement mal faite ». La décision : **porter fidèlement les 6 écrans de la maquette en composants React branchés sur les vraies données**, et décliner le même langage visuel sur les écrans non mockés. Zéro modification de la logique métier, des requêtes, de la RLS, du multi-tenant ni des tests existants.

## 2. Décisions validées (questions posées)

| Question | Réponse |
|---|---|
| Problème principal | Fidélité maquette |
| Étendue | Toute l'app (11 écrans) |
| Niveau de fidélité | Portage pixel près |
| Recherche globale | Fonctionnelle |
| Alertes dashboard | Cliquables (→ listes filtrées) |
| Export CSV / actions tableaux | Décoratif / déjà existant |
| Cloche, aide, tendance | Décoratifs |
| Approche | A — Portage fidèle |

## 3. Fondations (design system)

### 3.1 Tokens (`src/index.css`, Tailwind v4 `@theme`)
Alignement sur DESIGN.md :
- Couleurs : `surface #f9f9f7`, `surface-container-lowest #ffffff`, `surface-container-low #f4f4f2`, `surface-container #eeeeec`, `surface-container-high #e8e8e6`, `surface-container-highest #e2e3e1`, `on-surface #1a1c1b`, `on-surface-variant #45464d`, `outline-variant #c6c6ce`, `primary #09152e`, `primary-container #1f2a44`, `on-primary-container #8691b0`, `secondary #775928`, `secondary-container #ffd79b`, `secondary-fixed-dim #e8c086`, `error #ba1a1a`, `error-container #ffdad6`, vert/ambre statuts (badges).
- Typographies (classes utilitaires via `@theme` / composants) :
  - `display-lg` : 32px/700/40px, -0.02em
  - `headline-md` : 24px/600/32px
  - `headline-sm` : 20px/600/28px
  - `body-lg` : 16px/400/24px ; `body-md` : 14px/400/20px
  - `label-md` : 12px/600/16px, +0.05em
  - `data-mono` : 14px/500/20px, -0.01em (n° passeport, ID, montants)
- Police : Inter (Google Fonts, comme la maquette).
- Icônes : **Material Symbols Outlined** (Google Fonts), support FILL via `font-variation-settings: 'FILL' 1` (utilisé par la maquette pour les états actifs).
- Radius : cartes 16px (`rounded-xl`), inputs/boutons 8px (`rounded-lg`), badges pill.
- Layout : sidebar fixe 260px, contenu max 1440px, gutter 24px.

### 3.2 Nouveau composant `Icon` (`src/components/ui/Icon.tsx`)
Wrapper Material Symbols : `<Icon name="group" />`, props `name`, `fill` (booléen), `size` (20/24px par défaut), `className`. La classe `material-symbols-outlined` est posée par le composant.

## 4. Shell partagé

### 4.1 Sidebar (`src/components/layout/Sidebar.tsx`, maquette : en-tête de chaque `code.html`)
- Fixe gauche, `w-[260px]`, blanc (`surface-container-lowest`), `border-r border-outline-variant`, padding `py-6 px-4`.
- **Header** : logo rond 40px (initiale de l'agence ou icône, `rounded-full border`), titre **« Stitch Sama Pèlerin »** (`headline-sm` bold navy), sous-titre « Portail Administrateur » (`label-md`, `on-surface-variant`).
- **Nav groupée avec icônes Material** (gauche, étiquettes à droite, `gap-2` entre items) :
  - Tableau de bord (`dashboard`)
  - Pèlerins (`person`, fill si actif)
  - Groupes (`group`)
  - Documents (`description`)
  - Paiements (`payments`)
  - Administration / Membres (`settings`)
- **État actif** : `bg-surface-container text-primary font-bold border-l-4 border-secondary-fixed-dim translate-x-1` (la maquette utilise `secondary-fixed-dim` #e8c086 pour la bordure gold).
- **Bas de colonne** : Aide (`help_outline`) + Déconnexion (`logout`, texte `error`, `hover:bg-error-container`).
- Mobile : masquée, ouverte via bouton menu du topbar (overlay).

### 4.2 Topbar (`src/components/layout/Topbar.tsx`)
- Sticky, `h-[64px]`, blanc, `border-b border-outline-variant`, `px-6 py-3`, `flex justify-between`.
- Gauche : bouton menu (mobile) + titre d'app (ou page courante) `headline-sm` bold.
- Centre : **recherche globale fonctionnelle** (`max-w-md`, icône `search` à gauche, input pl-10, focus navy) — voir §7.
- Droite : cloche `notifications` + pastille `error` (décorative), `help_outline` (masqué mobile, décoratif), profil : `label-md` rôle réel + nom d'agence réel (`text-[10px]` variant), avatar rond 32px (`bg-primary-container` + initiale, la photo maquette est décorative).

## 5. Écrans mockés (portage)

### 5.1 Tableau de bord (`src/pages/Dashboard.tsx` ← `maquette/tableau_de_bord`)
- **En-tête** : `display-lg` « Tableau de bord » + sous-titre `body-lg` « Vue d'ensemble de la saison Hajj {année} » ; boutons : « Rapport Global » (secondaire blanc bordure navy, icône `download`, décoratif) et « Nouveau Pèlerin » (primaire navy, icône `add`, → `/liste-des-pelerins?nouveau=1` ou modal existant).
- **3 alertes cliquables** (grille 3 cols) : `bg-{couleur}-container/20 border-l-4 border-{couleur} rounded-r-lg p-4`, icône cerclée (`p-2 rounded-full bg-{c}/10 text-{c}`), titre `headline-sm` coloré + description `body-md` variant, flèche `arrow_forward` en apparition au survol (`group-hover`) :
  1. Dossiers incomplets (E-Visa) — rouge `error` → `/liste-des-pelerins?statut=incomplet`
  2. Paiements en retard — or `secondary` → `/paiements-echeanciers?statut=en_retard`
  3. Passeports expirant bientôt — rouge → `/liste-des-pelerins?alerte=passeport`
- **Grille bento** (3 cols, carte large `lg:col-span-2`) : cartes `bg-surface-container-lowest border rounded-xl p-6 shadow-sm hover:shadow-md` avec cercle décoratif `bg-primary/5` en fond, `label-md` uppercase + nombre `display-lg`, icône dans carré 48px `bg-primary-container text-on-primary-container rounded-lg`, badge tendance (`trending_up` vert) ; carte large = **progression financière** (barre de progression dorée `secondary-fixed-dim`, montants FCFA, libellés).
- **Rappels WhatsApp** : liste des rappels à envoyer/envoyés (wa.me), même langage de cartes.
- Données : requêtes TanStack Query existantes (pèlerins, groupes, tranches, paiements, rappels) — pas de nouvelles requêtes, uniquement réorganisation du rendu.

### 5.2 Liste des pèlerins (`src/pages/Pelerins.tsx` ← `maquette/liste_des_p_lerins`)
- En-tête : `display-lg` « Pèlerins » + sous-titre + bouton primaire « Nouveau Pèlerin » (`add`) et secondaire « Exporter » (décoratif si présent).
- **Cartes-compteurs** (Total Pèlerins / Validés / Incomplets) — `label-md` + nombre.
- **Tableau** :
  - En-tête : `bg-[#F1F5F9]`, `label-md` (nom, groupe, statut, téléphone, actions).
  - Lignes min 56px, `body-md`, bordure basse `outline-variant`.
  - Colonnes statuts : **badges pill** (Validé = vert, Incomplet = rouge, En attente = ambre).
  - **Actions au survol** : icônes `visibility` (Voir → `/details-du-pelerin/:id`), `edit` (Modifier → modal existant) — visibles au survol de la ligne (`opacity-0 group-hover:opacity-100`).
  - Recherche + filtre statut (`filter_list`) + pagination `chevron_left/right` (paginated components existants).
- ID passeport / n° de dossier en `data-mono`.

### 5.3 Liste des groupes (`src/pages/Groupes.tsx` ← `maquette/liste_des_groupes`)
- Même squelette : en-tête + bouton « Nouveau Groupe » (`group_add` si présent), tableau avec colonnes (nom, nombre de pèlerins, budget total FCFA, statut, actions survol Voir/Modifier), badges pill, filtre, pagination.

### 5.4 Gestion des documents (`src/pages/Documents.tsx` ← `maquette/gestion_des_documents`)
- En-tête + bouton « Nouveau Document » (`add`).
- Tableau/filtres par type de document (Passeport, Visa, Carnet de vaccination…) avec icônes dédiées : `badge` (passeport), `medical_information` (médical), `mosque` (visa), `check_circle` (validé), `hourglass_empty` (en attente), `error` (manquant).
- Statuts en badges pill, actions Voir/Modifier au survol.

### 5.5 Paiements & échéanciers (`src/pages/Paiements.tsx` ← `maquette/paiements_et_ch_anciers`)
- En-tête + bouton « Enregistrer un paiement » (`payments`).
- Grille des plans (carte par pèlerin/plan : budget total, versé, reste en FCFA, barre de progression) + tableau des tranches avec statuts pill (Payée = vert, Partielle = ambre, En retard = rouge) et bouton marquer payé.
- Timeline verticale des tranches (payé = `check_circle` vert, courant = doré, futur = gris).

### 5.6 Fiche pèlerin (`src/pages/PelerinDetail.tsx` ← `maquette/d_tails_du_p_lerin`)
- **Breadcrumbs** : « Pèlerins › Détails » (`label-md`, `chevron_right`).
- **En-tête** : `display-lg` « Dossier Pèlerin » + boutons « Modifier » (secondaire, `edit`) et « Enregistrer » (primaire, `save`) — brancher sur l'édition existante si applicable, sinon Modifier = modal existant.
- **Grille 4/8 cols** :
  - Gauche : carte profil (gradient `from-primary-container to-surface-tint opacity-20` en bandeau, avatar rond 96px `border-4`, nom `headline-md`, ID `PLG-…` en `data-mono`, badge groupe pill `secondary-fixed`, infos perso en label-md/body-md, pastille `photo_camera` décorative) + carte **Contact d'Urgence** (`contact_emergency`).
  - Droite : section **Documents Requis** (`folder_open`) avec compteur « x/y Validés » et grille de cartes documents (icône type dans carré teinté par statut : vert validé/ambre soumis/rouge manquant, titre `body-md` bold, exp. `label-md` variant, bouton « Voir » `visibility`) ; **barre de progression du dossier** (stepper horizontal 3 segments, remplissage couleur statut) ; section **« Progression des paiements »** : timeline verticale (tranches payées = vert, étape courante = doré `secondary-fixed-dim`, montants FCFA, date DD/MM/YYYY) + reste à payer.
- Données réelles : `usePelerin`/documents/tranches existants.

## 6. Écrans non mockés (déclinaison)

- **Login / Signup** (`src/pages/Login.tsx`, `Signup.tsx`) : fond `surface`, carte blanche `rounded-xl border p-8 max-w-md`, logo + nom app, champs `.input` label-md au-dessus, bouton primaire navy 8px, lien vers l'autre page (texte navy), alertes d'erreur avec `error-container`. Icônes `person`, `lock`, `email` si pertinent.
- **Onboarding** (`src/pages/Onboarding.tsx`) : même carte, stepper de création d'agence (étapes), bouton gold/navy selon étape, cohérent avec le design system.
- **Membres** (`src/pages/Membres.tsx`) : tableau conforme §4 (en-tête gris, badges pill de rôle `gerant`/`agent`, actions survol, invitation via modal existant).

## 7. Fonctionnel

- **Recherche globale (topbar)** : champ de saisie → sur soumission, redirige vers `/liste-des-pelerins?q=…` ou `/liste-des-groupes?q=…` selon la saisie (les listes lisent déjà un paramètre de filtre — à brancher si absent) ; au minimum : menu déroulant de résultats (pèlerins par nom/téléphone, groupes par nom) branché sur les requêtes existantes, clic → page détail.
- **Alertes cliquables** : liens vers listes avec filtre pré-appliqué (§5.1) ; chaque liste lit son paramètre de filtre (extension mineure du code de filtre existant, sans changement de requête si possible).
- **Actions tableaux** : déjà existantes (voir/modifier/marquer payé) — conserver.
- **Décoratifs** (non fonctionnels, comme convenu) : cloche notifications, bouton aide, tendance « +12 cette semaine », bouton « Rapport Global », pastille photo.

## 8. Non-objectifs

- Aucune modification de `schema.sql`, requêtes API, RLS, multi-tenant, auth, types.
- Aucune refonte des formulaires fonctionnels existants (modals) au-delà du style.
- Aucune nouvelle dépendance JS (icônes via Google Fonts, comme la maquette).
- Aucune modification des tests existants ; les tests UI en cours doivent rester verts.

## 9. Vérification

- `npm run test` (15 tests verts) et `npm run build` propre après chaque lot.
- Comparaison visuelle écran par écran avec `maquette/*/screen.png` (l'utilisateur fait foi).
- Contrôle navigateur : http://localhost:5173/ (serveur dev déjà actif).

## 10. Découpage d'implémentation (par lots)

1. **Fondations** : tokens index.css, `Icon.tsx`, alias/helpers (montants FCFA inchangés).
2. **Shell** : `Sidebar.tsx` + `Topbar.tsx` + `AppLayout.tsx` (recherche fonctionnelle incluse).
3. **Tableau de bord** : alertes cliquables, bento cards, rappels.
4. **Listes** : Pèlerins, Groupes, Documents, Paiements (tables + badges + actions survol + filtres par paramètre).
5. **Fiche pèlerin** : carte profil, documents, stepper, timeline.
6. **Pages restantes** : Login, Signup, Onboarding, Membres.
7. **Vérification finale** : tests + build + revue visuelle avec l'utilisateur.
