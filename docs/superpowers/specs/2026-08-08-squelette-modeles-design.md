# Design — Étape 1 : Squelette + Modèles + Admin + Données de test

Date : 2026-08-08
Projet : SaaS de gestion pour agences de Hajj & Omra (Dakar)
Statut : Validé par l'utilisateur

## Contexte

Le projet repart de zéro dans le dossier `Hajj Management`. Le document de cadrage
(`Cadrage_SaaS_Hajj_Omra-1.md`) définit le produit : un SaaS multi-tenant simple pour
petites et moyennes agences de voyage sénégalaises, centré sur les dossiers pèlerins,
les paiements échelonnés en FCFA et les rappels WhatsApp.

Choix utilisateur :
- Frontend : **single-file HTML (`front.html`) branché sur l'API DRF** (pas de React)
- Nouveau projet **propre** (les modèles validés de l'ancien projet servent de base)
- Étape 1 : **squelette + 9 modèles + admin + données de test** (CRUD, API et pages
  viendront aux étapes suivantes)
- `Utilisateur` : entité métier séparée du compte de connexion Django (conforme au doc
  de cadrage)
- Git initialisé dès maintenant

## Environnement

- Python 3.13.7, Django 6.0.2, DRF à installer
- Base SQLite en dev (MySQL réservé à la production)

## Architecture

### Structure

```
Hajj Management/
├── Cadrage_SaaS_Hajj_Omra-1.md
├── front.html                    (vide — rempli à l'étape frontend)
├── manage.py
├── requirements.txt              (Django + djangorestframework)
├── generate_test_data.py
├── verify_test_data.py
├── saas_hajj/                    (settings, urls, wsgi)
└── core/                         (modèles, admin)
```

### Configuration

- `INSTALLED_APPS` : + `core`, `rest_framework`, `django.contrib.humanize`
- `LANGUAGE_CODE = 'fr-fr'`, `TIME_ZONE = 'Africa/Dakar'`
- SQLite par défaut ; MySQL en production (hors périmètre)

## Modèle de données (9 entités)

Relations héritées de l'ancien projet (validées) :

- `Agence` (tenant) : nom, téléphone, email, adresse, logo, date_creation
- `Utilisateur` : agence FK, nom, téléphone, email, rôle (gérant/agent commercial)
- `Groupe` : agence FK, nom, type (hajj/omra), date_depart/retour, nb_places_max,
  propriétés `nb_pelerins_inscrits`
- `Pelerin` : groupe FK, identité, contact urgence, sexe, `statut_dossier`
  (incomplet/complet/valide) recalculé par `maj_statut_dossier()` selon les documents
- **Document** : pelerin FK, type (passeport/visa/certificat_vaccination/photo/autre),
  fichier, date, expiration, statut (manquant/soumis/valide/rejete), `unique_together`
  (pelerin, type)
- **PlanPaiement** : pelerin OneToOne, montant_total (FCFA), nombre_tranches ;
  propriétés `montant_paye` et `reste_du`
- **Tranche** : plan FK, numero, montant_prevu, date_echeance, statut
  (a_venir/payee/partielle/en_retard) auto via `maj_statut()`
- **Paiement** : tranche FK, montant_paye, date, mode (especes/wave/orange_money/
  virement/autre), reference, enregistre_par → Utilisateur ; recalcule le statut de la
  tranche à la sauvegarde
- **Rappel** : tranche OU document, canal (whatsapp/sms), date envoi, statut envoi
  (en_attente/envoye/echec)

## Admin

Toutes les entités enregistrées : inlines (Groupe→Pelerins, Pelerin→Documents,
PlanPaiement→Tranches, Tranche→Paiements), action « Recalculer le statut du dossier »,
filtres par agence/statut, recherche.

## Données de test

`generate_test_data.py` avec contexte sénégalais :
- 2 agences dakaroises (ex. Al Hidjah Travel Dakar, Voyages Al-Barakah)
- 3 groupes : Hajj 2027, Omra Ramadan 2027, Omra Décembre 2026
- 4 pèlerins (noms Ndiaye/Diop/Fall/Sy, téléphones +221 7X XXX XX XX)
- Documents mixtes + expirations variées
- Plans FCFA : Hajj 2 500 000 (5 tranches), Omra 800 000/750 000 (3 tranches)
- 1 tranche partiellement payée (test reste dû), rappels WhatsApp en attente

`verify_test_data.py` : vérifie compteurs et calculs (reste_du, statuts).

## Vérification

1. `python manage.py check` — zéro erreur
2. `makemigrations` + `migrate` — schéma créé
3. `generate_test_data.py` + `verify_test_data.py` — OK
4. `createsuperuser` — accès `/admin/`

## Hors périmètre (étapes suivantes)

CRUD, API DRF complète, `front.html`, dashboard orienté action, rappels WhatsApp
réels, multi-tenant (filtrage par agence côté requêtes).