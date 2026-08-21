# SamaPèlerin — SaaS de gestion Hajj & Omra

Gestion d'agences de voyage (Hajj/Omra) : groupes, pèlerins, documents, paiements
échelonnés FCFA et rappels WhatsApp. Stack : Supabase (Postgres + Auth + Storage + RLS)
+ Vite/React/TypeScript.

## Démarrage local

1. Créer un projet sur https://supabase.com (free tier).
2. Copier `.env.example` vers `.env` et renseigner `VITE_SUPABASE_URL` et
   `VITE_SUPABASE_ANON_KEY` ; copier la clé `service_role` dans `.env.local`
   (jamais commitée).
3. Authentication → Email : désactiver « Confirm email ».
4. SQL Editor : exécuter `supabase/schema.sql` puis `supabase/seed.sql`.
5. `npm install` puis `npm run seed:auth` (créé les comptes de démo).
6. `npm run dev`.

Comptes de démo (mot de passe `Hajj2027!`) :
- `moussa@alhidjah.sn` (gérant, Al Hidjah Travel Dakar)
- `fatou@alhidjah.sn` (agent, Al Hidjah Travel Dakar)
- `omar@albarakah.sn` (gérant, Voyages Al-Barakah)
- `aissatou@albarakah.sn` (agent, Voyages Al-Barakah)

## Déploiement (Cloudflare Pages)

Le routing SPA est géré par `public/_redirects` (`/* /index.html 200`).

1. Pousser le dépôt sur GitHub.
2. https://dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git.
3. Build command : `npm run build` — Output directory : `dist`.
4. Environment Variables (Production) : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
5. Deploy. Chaque push déploie automatiquement.

## Tests

`npm run test` — logique métier (format, tranches, statuts) en Vitest.
