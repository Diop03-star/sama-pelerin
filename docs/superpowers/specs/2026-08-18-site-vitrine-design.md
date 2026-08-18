# Design — Site vitrine + tutoriels vidéo

## Objectif

Ajouter un site vitrine public à l'app existante (Stitch Sama Pèlerin) présentant le SaaS, ses avantages, ses tarifs, des témoignages et un canal de contact — plus une galerie de tutoriels vidéo gérée par un back-office superadmin.

## Décisions validées

- **Emplacement** : routes publiques dans l'app React existante (pas de projet séparé).
- **Vidéos** : table Supabase `tutos`, ajoutées par le superadmin via un lien YouTube (pas d'upload de fichier).
- **Sections vitrine** : Hero + CTA, Avantages, Tarifs (grille Base/Avancé/Premium), Tutoriels, Témoignages, Contact.
- **Navigation** : page d'accueil vitrine + page `/tutoriels` séparée.
- **Contact** : bouton WhatsApp avec message pré-rempli (pas de formulaire).

## Architecture

### Routes

| Route | Page | Visibilité |
|---|---|---|
| `/` | Vitrine (Landing) | Publique |
| `/tutoriels` | Galerie publique de vidéos | Publique |
| `/superadmin/tutos` | CRUD vidéos | Superadmin (SuperAdminLayout existant) |

### Layout

Nouveau `PublicLayout` : navbar vitrine (logo, ancres vers les sections, boutons CTA) + footer. Le CTA s'adapte à la session via `useAuth()` :
- déconnecté → « Se connecter » (`/login`) et « Essayer gratuitement » (`/signup`)
- connecté → « Ouvrir l'app » (`/tableau-de-bord`)

La vitrine et `/tutoriels` sont rendus hors des layouts AppLayout/SuperAdminLayout existants.

### Données — table `tutos`

```sql
create table public.tutos (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  description text,
  url_youtube text not null,
  ordre int not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);
```

**RLS** : lecture publique (SELECT pour tous), écriture réservée superadmin via `is_superadmin()` (pattern existant dans le schéma).

**Règles d'affichage** :
- Vitrine et `/tutoriels` : `actif = true`, triés par `ordre` asc puis `created_at` desc.
- Back-office : toutes les vidéos, quel que soit `actif`.

### Témoignages

Tableau statique dans le composant (3 placeholders à remplacer par les retours des agences pilotes après la saison). Pas de table dédiée (YAGNI).

## Pages

### Vitrine (`/`) — 6 sections

1. **Hero** : titre accrocheur, sous-titre, CTA « Essayer gratuitement » / « Se connecter ». Visuel : `src/assets/hero.png` existant.
2. **Avantages** : 6 cartes —
   - Paiements échelonnés en FCFA (plans, tranches, reste dû automatique)
   - Rappels WhatsApp automatiques (échéances + documents)
   - Dossiers pèlerins centralisés (passeport, visa, vaccination, statut calculé)
   - Groupes avec quotas de places et répartition
   - Tableau de bord orienté action (alertes, retards, encaissements)
   - Multi-utilisateur (gérant + agents)
3. **Tarifs** : 3 cartes — Base 15 000 / Avancé 35 000 / Premium 75 000 FCFA/mois, avec CTA « Demander une démo » (WhatsApp). Mention de l'abonnement annuel (2 mois offerts).
4. **Tutoriels** : aperçu des 3 dernières vidéos actives + bouton « Voir tous les tutoriels » → `/tutoriels`.
5. **Témoignages** : 3 cartes placeholder (agences pilotes).
6. **Contact** : bouton WhatsApp `wa.me` avec message pré-rempli.

### Tutoriels (`/tutoriels`)

Grille de cartes : miniature YouTube (`https://img.youtube.com/vi/<ID>/hqdefault.jpg`), titre, description. Clic → ouverture de la vidéo sur YouTube (lien externe). Empty state si aucune vidéo.

### Admin (`/superadmin/tutos`)

- Liste des vidéos (titre, description tronquée, ordre, badge actif/inactif, actions modifier/supprimer).
- Formulaire ajout/édition : titre, description, URL YouTube, ordre, actif — dans une Modal (pattern existant).
- Suppression avec confirmation.
- Pré-remplissage : bouton « Ajouter une vidéo » + lien vers la vidéo dans la liste.
- Utilise react-query (mutations) + composants UI existants (Button, Modal, Field, Badge, EmptyState, Icon).

## Style

- Réutilisation du design system existant : palette navy/gold/vert, police Inter, Material Symbols, composants Button/Card/Badge/EmptyState/Modal.
- La vitrine utilise un rendu plus aéré et marketing (sections défilantes, cartes), cohérent avec la charte existante.
- Vidéo YouTube : extraction de l'ID depuis l'URL (`youtu.be`, `watch?v=`, formats courts) pour la miniature et le lien — helper dans `src/lib` avec tests.

## Données de test

Seed : 3-4 vidéos de démonstration (ordres différents, une inactive) pour valider tri et filtres.

## Tests (Vitest + Testing Library, patterns existants)

- `Landing.test.tsx` : sections rendues ; CTA adapté selon session (mock supabase auth) ; aperçu tutoriels affiche les vidéos actives triées.
- `Tutoriels.test.tsx` : grille avec vidéos (supabase mocké), empty state, ouverture lien YouTube.
- `SuperAdminTutos.test.tsx` : liste, ajout, édition, suppression (mocks react-query + supabase).
- `src/lib` : extraction d'ID YouTube (formats variés).

## SQL live

Le SQL de création de la table `tutos` + RLS est fourni à l'utilisateur pour application dans Supabase SQL Editor (comme les plans précédents).

## Hors périmètre

- Upload de fichiers vidéo (choix : liens YouTube uniquement).
- Formulaire de contact (choix : WhatsApp uniquement).
- Table témoignages (statique pour l'instant).
- Multi-langue.
- SEO avancé (meta de base suffisante).
