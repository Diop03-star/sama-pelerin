# Paramètres de l’agence — plan d’implémentation

> **Pour les agents d’implémentation :** exécuter les tâches dans l’ordre ci-dessous. Les interfaces produites par une tâche deviennent les dépendances des suivantes.

**Objectif :** livrer une page « Paramètres » utilisable uniquement par les gérants pour modifier leur agence, leur profil et leur mot de passe.

**Architecture :** ajouter `/parametres` sous une garde de rôle gérant, avec une section agence et une section compte. Persister les informations existantes dans `agences`, isoler la photo du gérant dans une table RLS dédiée, conserver les mots de passe dans Supabase Auth, et stocker les images dans le bucket privé scoped à l’agence.

**Stack technique :** React 19, TypeScript, React Router 7, TanStack Query 5, Supabase JS 2, PostgreSQL RLS et Supabase Storage.

**Conception :** `docs/superpowers/specs/2026-10-07-parametres-agence-design.md`

## Contraintes globales

- Réserver la page et les modifications de l’agence au rôle `gerant`; les contrôles de navigation seuls ne sont pas une frontière de sécurité.
- Garder la table `agences` source de vérité pour `nom`, `telephone`, `email`, `adresse` et `logo_url`.
- Le mot de passe reste géré par Supabase Auth; ne jamais le persister dans une table applicative.
- Utiliser le bucket privé `logos_agences` et conserver des chemins d’objets, jamais des URL signées expirantes, dans la base.
- Accepter PNG, JPEG et WebP jusqu’à 5 Mo.
- Les mises à jour d’agence ne doivent pas changer `active`.
- Les nouveaux champs et enregistrements doivent être facultatifs pour les comptes existants.

## Risques à garder en revue

1. Agent qui appelle directement l’API pour modifier l’agence : refuser par policy RLS et Storage même s’il connaît la route.
2. Gérant d’une autre agence qui tente de lire ou remplacer une image : vérifier l’agence dans le chemin Storage et les policies SQL.
3. Upload accepté côté navigateur mais refusé par Storage : afficher l’échec et conserver l’ancien chemin d’image.
4. Échec de mise à jour SQL après upload : supprimer le nouvel objet et ne pas supprimer l’ancien.
5. Mauvais mot de passe actuel ou confirmation différente : ne pas appeler la mise à jour Auth et conserver les autres formulaires indépendants.

---

### Task 1: Migrer le schéma et verrouiller les droits agence

**Fichiers :**
- Créer : `supabase/migrations/20261007_parametres_agence.sql`
- Modifier : `supabase/schema.sql`

**Interfaces :**
- Produit : `profils_gerants(utilisateur_id uuid primary key references utilisateurs(id) on delete cascade, avatar_url text)` avec RLS activée.
- Produit : policies rôle gérant sur la modification de `agences`, la table `profils_gerants` et les opérations d’écriture Storage dans `logos_agences`.

- [ ] Ajouter la migration additive et idempotente : créer `profils_gerants`, activer RLS, supprimer/remplacer `agences_update`, supprimer/remplacer `logos_write` et créer policies Storage d’insertion, mise à jour et suppression.
- [ ] Chaque policy `profils_gerants` vérifie que `utilisateur_id` correspond à la ligne `utilisateurs` liée à `auth.uid()` et que ce profil a le rôle `gerant`.
- [ ] Chaque policy de modification d’agence vérifie `id = current_agence_id()` et le rôle gérant; conserver l’écriture superadmin existante et refuser le changement d’agence active depuis le rôle gérant (`active = true` dans `WITH CHECK`).
- [ ] Les policies Storage de lecture restent limitées à l’agence. Les policies d’écriture vérifient le bucket `logos_agences`, le premier segment du chemin égal à l’agence courante, et l’existence d’un gérant courant de cette même agence.
- [ ] Mettre à jour `supabase/schema.sql` pour les installations neuves avec le même schéma et les mêmes policies que la migration; ne pas introduire de divergence entre baseline et migration.
- [ ] Relire les policies finales, y compris les anciennes policies à retirer, pour éviter qu’une policy permissive existante ne continue d’autoriser les agents.

### Task 2: Créer l’accès de route réservé aux gérants

**Fichiers :**
- Créer : `src/auth/GerantRoute.tsx`
- Modifier : `src/App.tsx`
- Modifier : `src/components/layout/Sidebar.tsx`
- Modifier : `src/components/layout/ProfilMenu.tsx`

**Interfaces :**
- `GerantRoute()` lit `useProfil()`, affiche le chargement pendant la requête, rend `<Outlet />` si `role === 'gerant'`, sinon redirige vers `/tableau-de-bord`.
- Route protégée : `/parametres` rend `<Parametres />` sous `GerantRoute` et `AppLayout`.

- [ ] Créer `GerantRoute` avec `useProfil`, `Navigate` et `Outlet`; attendre `isLoading` avant de décider.
- [ ] Ajouter la route `/parametres` sous `AppLayout` et `GerantRoute`; conserver `/profil` en lecture seule pour les agents et rediriger le gérant vers `/parametres`.
- [ ] Ajouter « Paramètres » dans la section Administration affichée uniquement pour `role === 'gerant'` dans la sidebar.
- [ ] Faire pointer l’entrée profil du gérant vers `/parametres` et la renommer « Paramètres »; garder « Mon profil » vers `/profil` en lecture seule pour les agents.
- [ ] S’assurer qu’un agent connecté qui saisit `/parametres` est renvoyé vers le tableau de bord, sans afficher la page.

### Task 3: Ajouter les primitives d’upload d’image

**Fichiers :**
- Créer : `src/lib/agenceImages.ts`
- Créer : `src/components/parametres/ImageUploadField.tsx`

**Interfaces :**
- `type ImageAgence = 'logo' | 'profil'`.
- `uploadImageAgence({ agenceId, utilisateurId, type, fichier }): Promise<string>` téléverse et retourne le chemin Storage persistable.
- `supprimerImageAgence(chemin): Promise<void>` supprime un ancien objet ou annule un nouvel upload.
- `obtenirUrlImageAgence(chemin): Promise<string | null>` retourne une URL signée ou `null` en cas de chemin absent.
- `ImageUploadField` prend `label`, `value`, `onChange`, `disabled` et affiche sélection, aperçu et erreur de validation.

- [ ] Valider `image/png`, `image/jpeg`, `image/webp` et une taille maximale de `5 * 1024 * 1024` octets avant tout upload.
- [ ] Générer un chemin unique `<agenceId>/logo/<uuid>.<ext>` pour le logo et `<agenceId>/profil/<utilisateurId>/<uuid>.<ext>` pour la photo.
- [ ] Uploader avec `supabase.storage.from('logos_agences').upload(path, file, { upsert: false })` et remonter les erreurs sans les masquer.
- [ ] Produire une URL signée via `createSignedUrl(path, durée)` sans jamais enregistrer cette URL en base.
- [ ] Fournir une fonction de suppression Storage pour que la page orchestre le remplacement dans l’ordre sûr : upload nouveau, update DB, puis suppression de l’ancien objet; si l’update DB échoue, supprimer le nouveau et garder l’ancien.
- [ ] L’aperçu local peut utiliser une URL `URL.createObjectURL`; libérer l’URL au remplacement/démontage et retomber sur l’URL signée après sauvegarde.

### Task 4: Construire la page Paramètres

**Fichiers :**
- Créer : `src/pages/Parametres.tsx`
- Créer : `src/components/parametres/AgenceSettingsSection.tsx`
- Créer : `src/components/parametres/GerantSettingsSection.tsx`
- Modifier : `src/lib/types.ts`
- Modifier : `src/components/layout/Sidebar.tsx`
- Modifier : `src/components/layout/ProfilMenu.tsx`

**Interfaces :**
- `AgenceSettingsSection` reçoit les données actuelles d’agence et `onSave(champsAgence)`.
- `GerantSettingsSection` reçoit le profil gérant, son `utilisateur_id`, l’image signée, `onSaveProfil(champsProfil)`, `onSaveAvatar(chemin)` et `onChangePassword(...)`.
- `Parametres` charge les requêtes, orchestre les mutations et invalide `['agence']`, `['profil']` et `['profil-gerant-photo']` après succès.

- [ ] Étendre `Agence` seulement si les nouveaux champs l’exigent et ajouter le type `ProfilGerant` correspondant à `profils_gerants`.
- [ ] Charger l’agence via `useAgence`, le profil via `useProfil` et `profils_gerants` via `utilisateur_id = profil.id`; distinguer chargement, erreur et absence de photo.
- [ ] Construire la section Agence avec nom requis, téléphone, email, adresse et champ logo; modifier uniquement `agences` de l’agence courante.
- [ ] Construire la section Compte gérant avec nom et téléphone depuis `utilisateurs`, photo depuis `profils_gerants` et formulaire de changement de mot de passe séparé.
- [ ] Pour sauvegarder le profil, modifier uniquement `nom` et `telephone` du profil courant; pour la photo, téléverser avec `uploadImageAgence`, créer ou mettre à jour `profils_gerants`, supprimer le nouvel upload si la mutation DB échoue, puis supprimer l’ancien fichier seulement après succès DB.
- [ ] Pour le mot de passe, obtenir l’email Auth avec `supabase.auth.getUser()`, vérifier le mot de passe actuel avec `signInWithPassword`, puis appeler `supabase.auth.updateUser({ password: nouveau })`; exiger confirmation identique et mot de passe d’au moins 8 caractères.
- [ ] Afficher une confirmation après succès seulement; garder les saisies en cas d’erreur et désactiver uniquement le formulaire en cours de sauvegarde.
- [ ] Invalider les clés React Query après sauvegarde; afficher le logo dans l’en-tête de la sidebar quand disponible, sinon garder l’icône actuelle; afficher la photo gérant dans le menu profil avec initiale de repli.

### Task 5: Finaliser les états, accessibilité et vérification

**Fichiers :**
- Modifier : `src/pages/Parametres.tsx`
- Modifier : `src/components/parametres/AgenceSettingsSection.tsx`
- Modifier : `src/components/parametres/GerantSettingsSection.tsx`
- Modifier : `src/components/parametres/ImageUploadField.tsx`
- Modifier : `src/components/layout/Sidebar.tsx`
- Modifier : `src/components/layout/ProfilMenu.tsx`

- [ ] Vérifier au clavier les champs, upload, boutons, messages et menus; donner un libellé explicite à chaque contrôle et annoncer les erreurs avec une relation accessible.
- [ ] Vérifier les états mobile/desktop et les aperçus avant/après sauvegarde avec l’application en cours d’exécution.
- [ ] Parcourir manuellement les cinq risques de la section « Risques à garder en revue » avec deux comptes de démonstration appartenant à des rôles/agences différents; confirmer que les refus RLS/Storage ne modifient aucune donnée.
- [ ] Exécuter `npm run build` et corriger les erreurs TypeScript ou de build introduites par cette fonctionnalité.
- [ ] Relire `git diff` et confirmer qu’aucune modification non liée au panneau Paramètres n’a été incluse.

## Auto-revue du plan

- **Couverture de la conception :** deux sections, droits gérant, données agence, avatar gérant isolé par RLS, mot de passe Auth, stockage privé, erreurs, image et mise à jour des éléments de navigation sont couverts dans les tâches 1 à 5.
- **Permissions :** la page est protégée côté route; les changements d’agence et les fichiers sont protégés côté backend; la photo gérant a une table distincte pour éviter d’élargir les mises à jour des membres.
- **Échecs d’image :** la séquence upload → DB → suppression ancienne et le rollback du nouvel objet sont spécifiés.
- **Concordance des types :** `utilisateur_id` référence `utilisateurs.id`; les clés de query utilisées sont explicites et doivent être identiques aux appels React Query.
- **Validation :** le plan prévoit une vérification manuelle des permissions et des uploads plus une compilation, sans créer ni lancer de tests automatisés.
