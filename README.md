# SamaPèlerin — SaaS de gestion Hajj & Omra

Gestion d'agences de voyage (Hajj/Omra) : groupes, pèlerins, documents, paiements
échelonnés FCFA et rappels WhatsApp. Stack : Supabase (Postgres + Auth + Storage + RLS)
+ Vite/React/TypeScript.

## Démarrage local

1. Créer un projet sur https://supabase.com (free tier).
2. Copier `.env.example` vers `.env` et renseigner `VITE_SUPABASE_URL` et
   `VITE_SUPABASE_ANON_KEY` ; copier la clé `service_role` dans `.env.local`
   (jamais commitée).
3. Authentication → Email : **activer « Confirm email »** (obligatoire pour la production).
4. SQL Editor : exécuter `supabase/schema.sql` puis `supabase/seed.sql`.
5. `npm install` puis `npm run seed:auth` (créé les comptes de démo).
6. `npm run dev`.

Comptes de démo (mot de passe `Hajj2027!`) :
- `moussa@alhidjah.sn` (gérant, Al Hidjah Travel Dakar)
- `fatou@alhidjah.sn` (agent, Al Hidjah Travel Dakar)
- `omar@albarakah.sn` (gérant, Voyages Al-Barakah)
- `aissatou@albarakah.sn` (agent, Voyages Al-Barakah)

## Déploiement (Cloudflare Pages / Workers Assets)

Le routing SPA est géré nativement (`not_found_handling: single-page-application` généré par le preset Vite de Wrangler — pas de `_redirects`).

1. Pousser le dépôt sur GitHub.
2. https://dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git.
3. Build command : `npm run build` — Output directory : `dist`.
4. Les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont **commitées dans `.env.production`** (valeurs publiques par conception — la RLS protège les données, jamais de `service_role` ici). Les Workers à assets statiques n'acceptent pas de variables runtime.
5. Deploy. Chaque push déploie automatiquement.

## Tests

`npm run test` — logique métier (format, tranches, statuts) en Vitest.

## Crédits images

- `src/assets/mecca.jpg` : « The Kaaba during Hajj - edited » par Adli Wahid (modifications par Basile Morin),
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:The_Kaaba_during_Hajj_-_edited.jpg), licence
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
