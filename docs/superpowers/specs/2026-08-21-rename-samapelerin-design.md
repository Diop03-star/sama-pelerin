# Renommage « Stitch Sama Pèlerin » → « SamaPèlerin » — Design

**Date :** 2026-08-21
**Statut :** approuvé

## Objectif

Renommer le SaaS « Stitch Sama Pèlerin » en « SamaPèlerin » (collé, avec accent) dans tout le produit, sauf les archives `docs/superpowers/` qui restent inchangées (traçabilité historique).

## Portée

| Fichier | Changement |
|---|---|
| `index.html` | `<title>SamaPèlerin</title>` |
| `src/pages/Login.tsx`, `Signup.tsx`, `Onboarding.tsx` | titre h1 → « SamaPèlerin » |
| `src/components/layout/Sidebar.tsx` | fallback `agence?.nom ?? 'SamaPèlerin'` |
| `src/components/layout/Topbar.tsx` | fallback → « SamaPèlerin » |
| `src/components/layout/SuperAdminLayout.tsx` | titre h1 → « SamaPèlerin » |
| `src/components/layout/PublicLayout.tsx` | 3 occurrences (logo, footer, copyright) |
| `src/pages/Landing.tsx` | 3 occurrences (texte hero, alt image, titre section) |
| `src/pages/Tutoriels.tsx` | 1 occurrence (sous-titre) |
| `src/lib/vitrine.ts` | `MESSAGE_DEMO` → « Bonjour, je souhaite une démo de SamaPèlerin. » |
| `README.md` | titre → « SamaPèlerin — SaaS de gestion Hajj & Omra » |
| `package.json` + `package-lock.json` | `name` → `sama-pelerin` (convention npm : minuscules, sans accent) |
| `supabase/schema.sql`, `supabase/seed.sql` | commentaires d'en-tête → « SamaPèlerin » |
| `docs/superpowers/**` | **inchangé** (archives) |

## Règles

- Écriture exacte : **SamaPèlerin** (P majuscule, accent sur le è).
- Nom npm : `sama-pelerin` (les noms npm n'acceptent ni majuscules ni accents).
- Aucun changement de logique métier, de routes ni de tests.
- Les textes de test existants (`Landing.test.tsx` etc.) ne référencent pas le nom de marque → aucun test à modifier.

## Vérification

1. `npm run test` — suite complète PASS.
2. `npm run build` — build OK.
3. `npm run lint` — aucune nouvelle erreur.
4. Grep final : plus aucune occurrence de « Stitch » hors `docs/superpowers/`.
