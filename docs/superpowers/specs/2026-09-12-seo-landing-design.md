# Design — Optimisation SEO de la landing page SamaPèlerin

Date : 2026-09-12
Statut : approuvé (utilisateur)

## Contexte

État des lieux du référencement :

- `index.html` : title « SamaPèlerin » seul, sans meta description, sans tags Open Graph, sans canonical.
- Aucun `robots.txt`, aucun `sitemap.xml` : Google peut indexer les 10 routes protégées par authentification (pages vides ou thin content).
- Pas de titres/metas par route : `/tutoriels`, `/login`, `/signup` partagent le title générique.
- Application React SPA 100 % client-side, déployée sur Cloudflare Workers Assets (`https://sama-pelerin.diopelzo659.workers.dev/`, fallback SPA `not_found_handling`).
- Point critique : les liens du produit circulent sur WhatsApp ; l'aperçu de lien WhatsApp lit les tags Open Graph du HTML statique sans exécuter le JS — l'aperçu actuel est pauvre.

Décisions utilisateur : rester sur `workers.dev` (pas de domaine propre pour l'instant) ; périmètre = quick wins complets ; générer une bannière OG 1200×630.

## Objectifs

1. Aperçu de lien WhatsApp / réseaux sociaux riche dès le HTML statique (sans JS).
2. SERP Google correcte (title + description optimisés sur les mots-clés : agence Hajj Omra, Sénégal, FCFA, WhatsApp).
3. Empêcher l'indexation des routes applicatives privées.
4. Titres/descriptions cohérents par page publique.

## Modifications

### 1. `index.html` — head enrichi (statique, la partie la plus importante)

- `<title>` : `SamaPèlerin — Logiciel de gestion pour agences de Hajj & Omra au Sénégal`
- `<meta name="description">` (≈155 caractères) :
  `Gérez vos pèlerins, leurs paiements échelonnés en FCFA et leurs dossiers (passeport, visa) depuis un seul outil. Rappels WhatsApp automatiques pour votre agence au Sénégal.`
- Canonical : `<link rel="canonical" href="https://sama-pelerin.diopelzo659.workers.dev/" />`
- Open Graph (aperçu WhatsApp/Messenger/Facebook) :
  - `og:type` = `website`
  - `og:site_name` = `SamaPèlerin`
  - `og:title` = title complet ci-dessus
  - `og:description` = description ci-dessus
  - `og:url` = `https://sama-pelerin.diopelzo659.workers.dev/`
  - `og:image` = `https://sama-pelerin.diopelzo659.workers.dev/og-image.png` (URL absolue obligatoire)
  - `og:image:width` = `1200`, `og:image:height` = `630`, `og:image:alt` = `SamaPèlerin — l'outil des agences de Hajj & Omra`
  - `og:locale` = `fr_SN`
- Twitter Card : `twitter:card` = `summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image` (mêmes valeurs).
- JSON-LD `SoftwareApplication` en `<script type="application/ld+json">` — données honnêtes déjà affichées sur la landing :
  - `name` = `SamaPèlerin`, `applicationCategory` = `BusinessApplication`, `operatingSystem` = `Web`
  - `description` = la meta description
  - `offers` : `@type=Offer`, `price=1500`, `priceCurrency=XOF` (pas d'autres champs — 1 500 FCFA/pèlerin inscrit, cohérent avec la landing)
  - `inLanguage` = `fr`
  - `url` = canonical
- `lang="fr"` conservé ; favicon/manifest/theme-color inchangés.

### 2. Nouveaux fichiers statiques dans `public/`

**`public/robots.txt`** :

```
User-agent: *
Allow: /
Disallow: /tableau-de-bord
Disallow: /membres
Disallow: /liste-des-groupes
Disallow: /liste-des-pelerins
Disallow: /details-du-pelerin
Disallow: /gestion-des-documents
Disallow: /paiements-echeanciers
Disallow: /onboarding
Disallow: /profil
Disallow: /superadmin
Disallow: /login

Sitemap: https://sama-pelerin.diopelzo659.workers.dev/sitemap.xml
```

(`/signup` reste indexable : page de conversion.)

**`public/sitemap.xml`** — les 2 pages publiques avec `lastmod` (date de la semaine en cours, mise à jour à chaque déploiement significatif), `changefreq` omis (Google l'ignore), priorités par défaut :

- `https://sama-pelerin.diopelzo659.workers.dev/`
- `https://sama-pelerin.diopelzo659.workers.dev/tutoriels`

**`public/og-image.png`** — bannière 1200×630 générée par script (PowerShell + System.Drawing, une commande, pas de dépendance npm) :

- fond navy `#09152e`, bande décorative or `#ffdeae`, logo `public/pwa-icon-512.png` à gauche
- textes : « SamaPèlerin » (gros) + tagline « L'outil des agences de Hajj & Omra »
- police système (Segoe UI) faute d'Inter installée comme police système — le PNG rend la police gélée, sans impact web
- remplaçable à tout moment par une version designée (le code n'y fait référence que par son chemin)

### 3. Hook `useSeo` — titres/metas par route

**`src/lib/useSeo.ts`** (nouveau, ~40 lignes, aucune dépendance) :

```ts
export function useSeo(options: { title: string; description?: string }): void
```

- Au montage : met à jour `document.title`, `meta[name=description]`, `og:title`, `og:description`, `og:url` (via `location.href`), et le `<link rel=canonical>` (crée les balises si absentes, à la manière d'un mini-helmet).
- Pas de restauration au démontage : chaque page publique appelle le hook avec ses valeurs complètes, ce qui rend la navigation déterministe (le retour sur une page remet ses propres valeurs).

Application (1 ligne par page, dans le composant de page) :

- `Tutoriels.tsx` : title `Tutoriels vidéo — SamaPèlerin` + description courte dédiée.
- `Login.tsx` : title `Connexion — SamaPèlerin` (pas de description, page utilitaire).
- `Signup.tsx` : title `Essayer gratuitement — SamaPèlerin` + description dédiée.
- `Landing.tsx` : le hook avec les valeurs par défaut d'`index.html` (title/description canoniques) — nécessaire puisque rien ne restaure les valeurs au démontage.

### 4. Tests (Vitest + jsdom, pas de dépendance)

- `src/lib/useSeo.test.ts` :
  - met à jour `document.title` et la meta description au montage ;
  - crée les balises `og:*` manquantes et met à jour les existantes ;
  - restaure les valeurs au démontage.
- Test de contenu statique (lit les fichiers avec `node:fs`, pas de rendu) :
  - `index.html` contient `og:image` avec URL absolue, la meta description et le JSON-LD ;
  - `public/robots.txt` contient `Disallow: /tableau-de-bord` et la ligne `Sitemap:` ;
  - `public/sitemap.xml` contient les 2 URLs publiques ;
  - `public/og-image.png` existe (taille > 0).
- Vérification finale : suite complète + `npm run lint` + `npm run build` + inspection du `dist/index.html` construit (tags présents dans le bundle).

## Hors scope

- Aucune dépendance npm (pas de react-helmet-async).
- Pas de pré-rendu statique / SSR (Google rend le JS ; les OG statiques couvrent les crawlers sociaux).
- Pas de changement de domaine — canonical = `workers.dev`. À revoir si un domaine est acheté (les tags OG/canonical contiennent l'URL en dur, une constante à mettre à jour).
- Pas de modification du routing, de la PWA ou du service worker.
- Les durées/contenus des tutoriels ne sont pas touchés.

## Risques et limites assumés

- Un sous-domaine `workers.dev` plafonne le référencement (autorité de domaine faible) — limitation connue, décision utilisateur.
- Les crawlers sociaux autres que Google ne voient que le head statique : c'est précisément ce que ce chantier corrige.
- Les routes protégées restent servibles (SPA fallback) mais non indexées : `robots.txt` est une directive, pas un verrou — aucune donnée n'est exposée (pages derrière auth de toute façon).
