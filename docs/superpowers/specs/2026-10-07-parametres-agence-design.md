# Paramètres de l’agence — conception

## Objectif

Permettre au gérant de mettre à jour les informations de son agence et ses propres éléments de profil depuis une page unique. Cette page rassemble les réglages qui sont actuellement absents ou dispersés dans l’application, tout en réservant les modifications de l’agence au rôle gérant.

## Périmètre

La page `/parametres` comporte deux sections :

1. **Agence** : nom, téléphone, email, adresse et logo.
2. **Compte gérant** : nom, téléphone, photo de profil et changement de mot de passe.

Chaque section enregistre séparément ses changements et affiche un état de chargement, une confirmation de succès ou une erreur compréhensible. Les champs de contact restent modifiables sans être obligatoires, sauf le nom de l’agence, qui reste requis conformément au schéma actuel.

Le mot de passe est celui du compte Supabase Auth du gérant. Le formulaire demande le mot de passe actuel, un nouveau mot de passe et sa confirmation. La mise à jour n’est envoyée qu’après vérification du mot de passe actuel et validation de la confirmation.

## Parcours et accès

- Ajouter « Paramètres » dans la section Administration réservée au rôle `gerant` de la barre latérale.
- Faire pointer l’entrée de menu du profil du gérant vers `/parametres` et la renommer « Paramètres »; garder « Mon profil » en lecture seule pour les agents.
- Ajouter une route `/parametres` protégée par une vérification du rôle `gerant`. Une navigation directe par un agent doit être refusée et redirigée vers le tableau de bord.
- Rediriger le rôle gérant de `/profil` vers `/parametres`, afin que les anciens liens continuent de fonctionner; conserver la page de profil en lecture seule pour les agents.
- Après sauvegarde, invalider les requêtes `agence` et `profil`; la barre latérale, le menu utilisateur et les autres éléments qui lisent ces données reflètent les changements sans rechargement.

## Données et stockage

### Base de données

- `agences` contient déjà `nom`, `telephone`, `email`, `adresse` et `logo_url`.
- `utilisateurs` contient déjà le nom et le téléphone du gérant.
- Ajouter une table `profils_gerants` liée à `utilisateurs` par une clé étrangère unique, avec un champ `avatar_url text`. Cette séparation permet d’appliquer une policy RLS gérant-only sans élargir les droits actuels d’édition des profils `utilisateurs`.
- Le mot de passe n’est jamais enregistré dans les tables applicatives; il reste géré par Supabase Auth.

### Images

- Réutiliser le bucket privé `logos_agences`.
- Enregistrer les fichiers dans des chemins propres à l’agence, par exemple `<agence_id>/logo/<uuid>.<extension>` et `<agence_id>/profil/<user_id>/<uuid>.<extension>`.
- Stocker dans `logo_url` et `avatar_url` le chemin de l’objet, et non une URL signée qui expire.
- Générer des URL signées pour afficher les images. Les membres de l’agence peuvent lire les images nécessaires à l’interface; seuls les gérants peuvent remplacer ou supprimer les fichiers de branding.
- Ajouter les règles Storage `UPDATE` et `DELETE` manquantes au bucket, limitées au dossier de l’agence et au rôle gérant. Garder les règles de lecture scoped à l’agence.
- Accepter les images PNG, JPEG et WebP jusqu’à 5 Mo. Vérifier le type et la taille côté client; les règles d’accès Storage restent la frontière de sécurité.
- Téléverser vers un chemin unique, mettre à jour la référence en base, puis supprimer l’ancien fichier. Si la mise à jour en base échoue, supprimer le nouvel upload et conserver l’ancienne référence.

## Autorisations et sécurité

- L’interface, la route `/parametres`, les opérations de profil et les règles RLS/Storage doivent appliquer le rôle `gerant`; masquer le lien dans la barre latérale ne suffit pas.
- Corriger la policy `agences_update`, qui autorise aujourd’hui les membres de l’agence sans vérifier leur rôle. Autoriser le gérant de cette agence et le superadmin; ne pas autoriser le changement de `active` depuis cette page.
- Ajouter des policies RLS à `profils_gerants` : le gérant authentifié peut lire et modifier uniquement son propre enregistrement; les agents ne peuvent ni créer, ni lire, ni modifier ces enregistrements. Préserver les restrictions actuelles protégeant `role`, `agence_id` et `user_id` dans `utilisateurs`.
- Les agents ne doivent pas pouvoir modifier les informations de l’agence ni le profil du gérant via les API de données.
- Le changement du mot de passe utilise la session du gérant et Supabase Auth; aucun secret n’est persisté ou journalisé.

## États et erreurs

- Désactiver le bouton de sauvegarde pendant la requête et prévenir les doubles soumissions.
- Afficher les erreurs de validation (format/poids image, champs requis, confirmation du mot de passe) près du formulaire concerné.
- Pour les échecs réseau, Storage, RLS ou Auth, garder les valeurs saisies et afficher un message qui permet de réessayer.
- N’annoncer un changement réussi qu’après confirmation du backend; rafraîchir les URL signées après remplacement d’une image.

## Approches considérées

1. **Une page de paramètres unique avec deux sections (retenue)** : agence et compte du gérant sont rassemblés dans un endroit, avec des sauvegardes distinctes et une séparation claire des données.
2. **Deux pages distinctes** : séparation plus forte entre agence et profil, mais davantage de navigation et une expérience moins directe pour les réglages demandés.
3. **Étendre la page profil actuelle sans nouvelle route** : modification minimale de navigation, mais mélange durable de la présentation du profil et des réglages de l’agence.

## Hors périmètre

- Paramètres de devise, fiscalité, notifications ou préférences des pèlerins.
- Changement d’email d’authentification, récupération de mot de passe oublié ou gestion des mots de passe des agents.
- Modification de l’état actif de l’agence ou gestion des membres.
- Création d’une nouvelle agence; l’onboarding existant reste le parcours de création.

## Critères d’acceptation

- Un gérant peut ouvrir la page et modifier les champs de son agence ainsi que son profil.
- Un changement de logo ou de photo apparaît après sauvegarde et persiste après rechargement.
- Un changement de mot de passe nécessite le mot de passe actuel et deux nouvelles valeurs concordantes; le nouveau mot de passe permet ensuite de se connecter.
- Un agent ne voit pas le menu Paramètres et ne peut ni ouvrir la route ni modifier ces données directement via les API.
- Les données existantes et les comptes sans ligne/photo de profil restent fonctionnels.
- Une erreur de sauvegarde ne présente pas la modification comme réussie et conserve les valeurs saisies.

## Vérification prévue

- Ajouter des tests de page pour les rôles gérant/agent, les sauvegardes et validations de formulaires.
- Ajouter ou vérifier les tests SQL/policies pour l’isolation entre agences et l’interdiction d’écriture par les agents.
- Exécuter la suite de tests et la compilation après implémentation; valider aussi le parcours des deux images dans l’application.

## Auto-revue

- Le périmètre distingue explicitement les informations agence, profil gérant et mot de passe Auth.
- La page unique, les droits gérant, la migration de profil et le stockage des images partagent les mêmes conventions de chemin et de données.
- Les URL signées ne sont pas persistées; l’échec d’une sauvegarde d’image ne doit pas laisser une référence cassée.
- La règle existante d’activation agence reste contrôlée par le superadmin.
- Aucun détail sur les reçus ou les paramètres de devise n’est impliqué dans la demande actuelle.
