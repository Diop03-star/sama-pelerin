# Design — Reconstruction du projet sur Supabase + Vite/React

Date : 2026-08-13
Projet : SaaS de gestion pour agences de Hajj & Omra (Sénégal) — « Stitch Sama Pèlerin »
Statut : Validé par l'utilisateur (sections 1 à 6 approuvées)

## Contexte

Le projet repart de zéro. L'ancienne base Django 6 + DRF + SQLite (core/, saas_hajj/,
manage.py, front.html, scripts Python) est **supprimée** — conservée dans l'historique
git et les documents. Le modèle de données (9 entités) validé dans l'ancien projet
sert de base au nouveau schéma.

Choix utilisateur (validés) :
- Backend : **Supabase hébergé** (free tier) — Postgres, Auth, Storage, RLS
- Frontend : **Vite + React + TypeScript**, Tailwind CSS, TanStack Query, React Router
- Périmètre : intégral (9 entités, multi-tenant, paiements FCFA, documents, rappels)
- Rappels WhatsApp : **gratuits** — liens `wa.me` + suivi manuel envoyé/échec (pas d'envoi automatique payant)
- Multi-tenant : **Supabase Auth + RLS** (approche A validée)
- Maquette : zip `stitch_sama_p_lerin_saas.zip` (6 pages + DESIGN.md) extrait dans `maquette/` comme référence d'implémentation
- Déploiement : **Vercel** (free tier) pour le frontend ; Supabase hébergé pour le backend

## Architecture

```
┌─────────────────────────────┐      ┌──────────────────────────────┐
│  Frontend : Vite + React +  │      │  Supabase (hébergé, free)    │
│  TypeScript (SPA)           │─────▶│  - Postgres (BDD)            │
│  - React Router             │      │  - Auth (email/mot de passe) │
│  - @supabase/supabase-js    │      │  - Storage (docs, logos)     │
│  - TanStack Query           │      │  - RLS (multi-tenant)        │
│  - Tailwind CSS             │      │  - Triggers/fonctions SQL    │
└─────────────────────────────┘      └──────────────────────────────┘
```

- Clés : `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` dans le frontend (sécurité par RLS, jamais par le client)
- Structure du repo : `supabase/` (SQL migrations + seed), `src/` (app React), `maquette/` (référence UI extraite du zip)
- Logique métier (statuts tranche/dossier) : fonctions SQL + triggers, comme en Django

## Base de données

### Tables (9 entités + auth)

Toutes les tables métier portent `agence_id` (clé du multi-tenant, filtrée par RLS).

```
agences          : id, nom, telephone, email, adresse, logo_url, created_at
utilisateurs     : id, user_id (→ auth.users, unique), agence_id, nom,
                   telephone, email, role (gerant/agent)
groupes          : agence_id, nom, type_voyage (hajj/omra), date_depart,
                   date_retour, nb_places_max, created_at
pelerins         : agence_id, groupe_id, nom, prenom, telephone, email,
                   date_naissance, sexe, contact_urgence_nom,
                   contact_urgence_telephone, statut_dossier
                   (incomplet/complet/valide), date_inscription
documents        : agence_id, pelerin_id, type_document (passeport/visa/
                   certificat_vaccination/photo/autre), fichier_url (Storage),
                   date_expiration, statut (manquant/soumis/valide/rejete),
                   date_upload, UNIQUE (pelerin_id, type_document)
plans_paiement   : agence_id, pelerin_id (unique), montant_total, devise (FCFA),
                   nombre_tranches, created_at
tranches         : agence_id, plan_paiement_id, numero_tranche, montant_prevu,
                   date_echeance, statut (a_venir/payee/partielle/en_retard),
                   UNIQUE (plan_paiement_id, numero_tranche)
paiements        : agence_id, tranche_id, montant_paye, date_paiement,
                   mode (especes/wave/orange_money/virement/autre), reference,
                   enregistre_par (→ utilisateurs.id)
rappels          : agence_id, tranche_id (nullable), document_id (nullable),
                   canal (whatsapp/sms), date_envoi_prevue, date_envoi_reelle,
                   statut_envoi (en_attente/envoye/echec)
```

### Logique métier côté base

- `maj_statut_tranche()` : déclenchée après insertion/modification de `paiements` ;
  payee si verse >= prevu, partielle si verse > 0, en_retard si échéance dépassée, sinon a_venir
- `maj_statut_dossier()` : déclenchée après insertion/modification de `documents` ;
  valide si tous valides, complet si tous soumis/valides, sinon incomplet
- `montant_paye` / `reste_du` : fonctions SQL ou vues calculées
- Trigger sur `auth.users` : inscription → ligne `utilisateurs` (agence_id NULL, rôle agent)

### RLS

Politique par défaut sur chaque table métier :
`agence_id = (SELECT agence_id FROM utilisateurs WHERE user_id = auth.uid())`.
Lecture/écriture uniquement pour les lignes de l'agence de l'utilisateur connecté.
Buckets Storage : `documents_pelerins/{agence_id}/{pelerin_id}/` et
`logos_agences/{agence_id}/` avec politiques RLS équivalentes.

## Auth & multi-tenant

- Connexion email + mot de passe (Supabase Auth) — pages /login et /signup
- Premier login → assistant onboarding « Créer mon agence » (nom, téléphone, adresse) ; l'utilisateur devient gérant
- Le gérant invite des agents (email + mot de passe) liés à son agence_id
- Rôles : gérant (tout, y compris membres et paramètres) ; agent commercial (dossiers, documents, paiements, rappels)
- Un utilisateur appartient à une seule agence ; simple déconnexion pour changer de compte

## Pages (alignées sur la maquette)

```
/login                     Connexion
/signup                    Inscription
/onboarding                Création de l'agence (premier login, gérant)
/tableau-de-bord           Dashboard : compteurs + actions du jour
/liste-des-groupes         Groupes Hajj/Omra (CRUD)
/liste-des-pelerins        Pèlerins (recherche, tableaux)
/details-du-pelerin/:id    Fiche : identité, progression documents,
                           timeline paiements, contact urgence
/gestion-des-documents     Documents de tous les pèlerins (statuts)
/paiements-echeanciers     Trésorerie : échéanciers, reste dû
/membres                   (gérant) : inviter/révoquer les agents
```

Comportements clés :
- Fiche pèlerin : upload documents (Storage), marquer soumis/validé/rejeté
- Plan de paiement : création auto des tranches, encaissement (Wave/OM/espèces/virement), statuts recalculés en direct
- Rappels : bouton « Envoyer sur WhatsApp » → `wa.me/<téléphone>?text=<message>` (message pré-rempli : tranche échue ou document manquant), puis « Marquer envoyé/échec »
- Dashboard : rappels en attente, tranches en retard, dossiers incomplets

## Design system (DEPUIS LA MAQUETTE — DESIGN.md)

- Style : Corporate Modernism, administrative clarity, spiritual dignity
- Couleurs : navy primary `#09152E`, or secondary `#775928` (actions/achievements),
  fond `#F9F9F7`, cartes `#FFFFFF`, bordures 1px `#E2E8F0`, pas d'ombres lourdes
- Statuts : rouge (bloquant/retard/rejeté), ambre (en cours/en attente), vert (payé/validé)
- Typographie : Inter ; titres 20-32px, corps 14-16px, labels 12px (letter-spacing 0.05em) ;
  mono pour passeports/IDs ; montants suffixés « FCFA » (ex. 2.500.000 FCFA) ; dates DD/MM/YYYY ; français
- Layout : sidebar fixe 260px, contenu max 1440px, grille 12 colonnes, gutters 24px
- Composants : bouton primaire navy/blanc, secondaire blanc/bordure navy ; inputs 1px bordure,
  focus navy ; badges pill ; cartes rounded 16px, boutons/inputs 8px ; sidebar nav active
  (teinte navy + bordure or 4px gauche) ; tables densité confortable (rangées ≥ 56px),
  headers gris clair, quick actions au survol ; alert panels (tinte basse + bordure 4px colorée) ;
  barres de progression étapes ; timeline paiements (or = étape courante, vert = payé)
- La maquette extraite dans `maquette/` (screens + code.html + DESIGN.md) sert de référence
  fidèle pour chaque page

## Rappels WhatsApp (gratuit)

- Messages pré-remplis : tranche échue (« Rappel : échéance du DD/MM/YYYY pour X FCFA — tranche N »)
  ou document manquant/expiré ; canal whatsapp ou sms (suivi seulement)
- Ouverture `https://wa.me/221XXXXXXXXX?text=<encodé>` dans un nouvel onglet
- « Marquer envoyé » / « Marquer échec » → met à jour date_envoi_reelle + statut_envoi
- Rappels créés manuellement (par tranche ou par document)

## Données de test (seed SQL, contexte sénégalais)

- 2 agences dakaroises : Al Hidjah Travel Dakar, Voyages Al-Barakah (+ gérants/agents)
- 3 groupes : Hajj 2027, Omra Ramadan 2027, Omra Décembre 2026
- 4 pèlerins : Ndiaye/Diop/Fall/Sy, téléphones +221 7X XXX XX XX
- Documents mixtes (statuts + expirations variées)
- Plans FCFA : Hajj 2 500 000 (5 tranches), Omra 800 000/750 000 (3 tranches), 1 tranche partielle
- Rappels WhatsApp en attente
- Seed exécutable via SQL Editor du Dashboard et versionné dans `supabase/seed.sql`

## Vérification

1. `npm run build` (TypeScript + Vite) — zéro erreur
2. Seed exécuté → données visibles dans le Dashboard Supabase
3. Parcours manuel complet : login gérant → onboarding → groupe → pèlerin → upload document →
   encaissement → rappel WhatsApp
4. Test RLS : connexion avec un compte de l'autre agence → aucune donnée visible
5. Déploiement Vercel : build automatique à chaque push

## Phases de construction

1. Nettoyage du dossier + scaffold Vite + connexion Supabase + schéma SQL + RLS
2. Auth + onboarding agence + membres
3. Groupes + pèlerins + documents (Storage)
4. Plans de paiement + tranches + encaissements
5. Rappels WhatsApp + dashboard
6. Seed + tests + déploiement Vercel

## Hors périmètre

- Envoi automatique de messages WhatsApp (API Meta/Twilio payante)
- Envoi SMS réel
- Multi-agences par utilisateur
- App mobile native