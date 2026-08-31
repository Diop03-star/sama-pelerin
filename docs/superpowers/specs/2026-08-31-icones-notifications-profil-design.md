# Icônes notifications & profil fonctionnelles — Design

**Date :** 2026-08-31
**Statut :** approuvé

## Objectif

Rendre fonctionnelles les icônes actuellement décoratives de la Topbar (spécifiées « décoratives, comme convenu » dans `2026-08-14-ui-fidelite-maquette-design.md`) :
- **Cloche notifications** → panneau déroulant des rappels en attente/échec.
- **Avatar profil** → menu déroulant (mon profil, aide, déconnexion) + nouvelle page profil `/profil`.
- **Boutons « Aide »** (Topbar + Sidebar) → lien vers `/tutoriels` (page existante).

## Portée

| Fichier | Changement |
|---|---|
| `src/hooks/useDropdown.ts` | **Nouveau** — hook partagé d'ouverture/fermeture de dropdown : fermeture au clic extérieur (listener `mousedown` sur `document`) et touche Échap |
| `src/components/layout/NotifPanel.tsx` | **Nouveau** — cloche + panneau de notifications |
| `src/components/layout/ProfilMenu.tsx` | **Nouveau** — avatar + menu déroulant profil |
| `src/pages/Profil.tsx` | **Nouveau** — page profil en lecture seule |
| `src/components/layout/Topbar.tsx` | Remplacer la cloche décorative par `NotifPanel`, l'avatar par `ProfilMenu`, bouton Aide → lien `/tutoriels` |
| `src/components/layout/Sidebar.tsx` | Lien « Aide » → `/tutoriels` (+ fermeture du menu mobile) |
| `src/App.tsx` | Route `/profil` sous `AppLayout` |

## Comportement

### NotifPanel
- Requête React Query (queryKey `notifications-rappels`) : `rappels` où `statut_envoi IN ('en_attente','echec')`, jointure `tranche`/`document` → `pelerin` (même pattern que `Dashboard.tsx`), tri `date_envoi_prevue` ascendant, limite 10.
- Pastille rouge sur la cloche = nombre de rappels retournés.
- Chaque item : nom du pèlerin, nature (tranche/document), date prévue (`formatDate`), badge statut (`LIBELLES_RAPPEL`/`TONE_RAPPEL`), clic → `/details-du-pelerin/:id`.
- État vide : « Aucune notification ».
- Échec de requête : état vide avec « Impossible de charger les notifications ».
- Fermeture : clic extérieur, Échap, ou navigation après clic sur un item.

### ProfilMenu
- Bouton avatar (initiale du nom) + menu : en-tête (nom, rôle), « Mon profil » → `/profil`, « Aide » → `/tutoriels`, « Déconnexion » → `supabase.auth.signOut()` puis navigation `/login`.
- Fermeture : clic extérieur, Échap, ou après action.

### Page Profil
- Lecture seule, protégée par `AppLayout` (déjà gardé).
- Affichage : avatar rond 96px avec initiale, nom, email, rôle (libellé Gérant/Agent), nom de l'agence, téléphone, « membre depuis » (`formatDate` sur `created_at`).
- Données : `useProfil()` + `useAgence()` existants.
- Si `profil` null : message « Profil introuvable ».

## Périmètre

- Layout des agences uniquement (`AppLayout`). Le layout superadmin reste inchangé.
- Page profil en lecture seule : aucune édition de profil (YAGNI).

## Vérification

1. Nouveaux tests : `NotifPanel.test.tsx`, `ProfilMenu.test.tsx`, `Profil.test.tsx` (mocks supabase, MemoryRouter, clic extérieur).
2. `npm run test` — suite complète PASS.
3. `npm run lint` — aucune erreur.
4. `npm run build` — build OK.
5. Vérification manuelle : cloche affiche les rappels de l'agence, avatar ouvre le menu, `/profil` affiche les infos, Aide ouvre `/tutoriels`.