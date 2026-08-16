# Design — Métadonnées de document : date d'expiration et numéro de document

Date : 2026-08-16

## Objectif

Permettre de renseigner la **date d'expiration** et le **numéro de document** d'un document de dossier pèlerin (passeport, visa, certificat de vaccination…), à la création (flux « Valider sans fichier ») et en modification des documents existants. Aujourd'hui, `date_expiration` existe en base mais n'est jamais saisie (« Expire le — » partout), et il n'existe aucune colonne numéro.

## Approche retenue

Fonctions partagées dans `src/lib/documents.ts` + une modal d'édition réutilisable (`ModifierDocumentModal`) ouverte depuis la fiche pèlerin (clic sur carte) et la page Gestion des documents (bouton par ligne). Les champs date + numéro sont aussi ajoutés aux deux flux « Valider sans fichier ». Le téléversement de fichier reste inchangé (édition possible ensuite via la modal).

## Conception

### 1. Base de données et types

- Migration : `alter table public.documents add column numero_document text;` — à appliquer dans `supabase/schema.sql` (après la ligne 61, `date_expiration date`) **et** sur la base live (requête SQL à exécuter dans le SQL editor Supabase). La colonne `date_expiration date` existe déjà.
- Aucun changement RLS : la policy `documents_all` (`for all`) couvre les nouvelles colonnes.
- `src/lib/types.ts` : ajouter `numero_document: string | null` au type `Document` (à côté de `date_expiration`).

### 2. Fonctions partagées — `src/lib/documents.ts`

- Étendre `validerSansFichier` avec un paramètre optionnel `metadonnees?: { date_expiration?: string; numero_document?: string }` : seules les clés définies (≠ `undefined`) sont incluses dans l'upsert → comportement actuel inchangé si non fourni. `fichier_url` reste **jamais** envoyé (contrainte existante).
- Nouvelle fonction `majMetadonnees(docId, metadonnees)` : `supabase.from('documents').update(metadonnees).eq('id', docId)`, throw si `error` (même convention que `majStatut`).
- Normalisation : valeurs vides (`''`) converties en `null` — jamais de string vide en base.

### 3. Modal d'édition partagée — `src/components/documents/ModifierDocumentModal.tsx`

- Réutilise le composant `Modal` existant (`open`, `title`, `onClose`).
- Props : `{ doc: Document; open: boolean; onClose: () => void; onSaved: () => void }` — `onSaved` laisse la page parente faire ses invalidations react-query.
- Contenu : `input type="date"` prérempli avec `doc.date_expiration` + champ texte « N° de document » prérempli avec `doc.numero_document`. Valeurs au format `YYYY-MM-DD` (format natif `input type="date"`, compatible colonne `date`).
- Boutons : Annuler (`onClose`) / Enregistrer (disabled pendant `isPending`). À l'enregistrement : `majMetadonnees(doc.id, { date_expiration, numero_document })` (vides → `null`), puis `onSaved()` + `onClose()`. Erreur affichée dans la modal si l'update échoue.
- Titre : « Modifier {libellé du document} » (`LIBELLES_DOCUMENT`).

### 4. Fiche pèlerin — `src/components/documents/DocumentSection.tsx`

- **Barre « Valider sans fichier »** : à côté du select type existant, ajouter `input type="date"` (aria-label « Date d'expiration ») et `input text` (aria-label « Numéro de document »). Au clic, la mutation transmet `{ date_expiration, numero_document }` (vides → non envoyés). Champs réinitialisés après succès.
- **Carte document** : la ligne d'info affiche « N° {numero_document} · Expire le {date} » si `numero_document` est renseigné, sinon affichage actuel (« Fichier joint/Aucun fichier · Expire le … »). Nouveau bouton icône « Modifier » (edit) à côté des actions Valider/Rejeter/Supprimer → ouvre `ModifierDocumentModal` avec ce document.
- **Invalidations** : après sauvegarde (via `onSaved`) : `['documents', pelerinId]` et `['pelerin', pelerinId]`.

### 5. Gestion des documents — `src/pages/Documents.tsx`

- **Formulaire « Valider sans fichier »** (barre avec select Pèlerin + Type) : ajouter les 2 mêmes champs (`input type="date"` aria-label « Date d'expiration », `input text` aria-label « Numéro de document »). Transmis à `validerSansFichier` ; champs + sélection du pèlerin réinitialisés après succès.
- **Tableau** : nouvelle colonne « N° document » (entre Document et Statut) affichant `numero_document` ou « — ». Colonne Expiration inchangée (désormais alimentée).
- **Actions par ligne** : bouton icône « Modifier » (edit) à côté de Valider/Rejeter → ouvre `ModifierDocumentModal`. `onSaved` invalide `['documents-tous']`, `['pelerins']`, `['pelerin']`.
- **Alerte passeport** (expirant dans 90 j, `expirantDans`) : inchangée — fonctionne dès qu'une date est renseignée.

### 6. Tests

- `src/lib/documents.test.ts` : `validerSansFichier` avec métadonnées (payload inclut `date_expiration`/`numero_document`, toujours sans `fichier_url`) ; sans métadonnées → payload inchangé ; `majMetadonnees` (update avec payload, `.eq('id')`, throw si error).
- Nouveau `src/components/documents/ModifierDocumentModal.test.tsx` : ouverture avec valeurs préremplies ; saisie + Enregistrer → update avec normalisation (`''` → `null`) + `onSaved`/`onClose` ; Annuler → aucun appel ; erreur affichée si update échoue.
- `src/components/documents/DocumentSection.test.tsx` : champs remplis → la mutation transmet les valeurs ; clic « Modifier » ouvre la modal ; sauvegarde invalide les requêtes.
- `src/pages/Documents.test.tsx` : formulaire avec date + n° → payload transmis + réinitialisation ; bouton Modifier ligne → modal → invalidation.
- Tests existants non cassés (payload sans métadonnées = comportement actuel).

Conventions : vitest + testing-library, mock `vi.hoisted`, `QueryClientProvider`, `MemoryRouter` pour les pages rendant des `Link`, mock de `../lib/supabase` obligatoire (import.meta.env).

## Fichiers touchés

| Fichier | Action |
|---|---|
| `supabase/schema.sql` | + `numero_document text` |
| `src/lib/types.ts` | + champ type |
| `src/lib/documents.ts` | étendre `validerSansFichier`, + `majMetadonnees` |
| `src/lib/documents.test.ts` | + tests |
| `src/components/documents/ModifierDocumentModal.tsx` | nouveau |
| `src/components/documents/ModifierDocumentModal.test.tsx` | nouveau |
| `src/components/documents/DocumentSection.tsx` | + champs, affichage N°, bouton Modifier |
| `src/components/documents/DocumentSection.test.tsx` | + tests |
| `src/pages/Documents.tsx` | + champs, colonne N°, bouton Modifier |
| `src/pages/Documents.test.tsx` | + tests |

Vérifications : `npm test`, `npm run lint`, `npm run build`. Migration SQL live : requête fournie à l'utilisateur pour le SQL editor Supabase.