# Préparation au pilote — 4 agences

Objectif : tester SamaPèlerin avec **4 agences minimum** avant le lancement, pour
recueillir des retours structurés. Accès gratuit sur la saison contre feedback.
Aligné sur le cadrage produit (§7 Stratégie de lancement pilote).

---

## 1. Objectif du pilote

- Valider le produit en conditions réelles (dossiers, paiements échelonnés, rappels).
- Recueillir un feedback structuré à 3 points dans la saison.
- Décider des évolutions (API WhatsApp, tutos) et du modèle tarifaire.
- Objectif final : 4 agences actives avec données réelles.

---

## 2. Checklist exécutable

### Étape 1 — Déploiement

- [ ] Fusionner la branche `rename-samapelerin` dans `main`.
- [ ] Déployer sur Cloudflare Pages (URL stable, pas de `npm run dev`).
  - Build command : `npm run build` — Output directory : `dist`.
  - Env vars production : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
  - Routing SPA déjà géré par `public/_redirects` (`/* /index.html 200`).
- [ ] Préparer un projet Supabase pilote propre : les données de démo du seed
      doivent être isolées (jamais visibles par une agence réelle).
- [ ] Vérifier le bon fonctionnement de l'inscription + onboarding agence.

### Étape 2 — Parcours de bout en bout

- [ ] `npm run test` passe (Vitest).
- [ ] Validation manuelle complète :
      inscription → création d'agence → groupe → pèlerin → documents →
      plan de paiement → encaissement partiel → rappel WhatsApp.
- [ ] Tester sur **mobile** (les gérants consultent depuis un téléphone).

### Étape 3 — Hors périmètre pilote (évolutions post-feedback)

Repoussé après le recueil des feedbacks — ne pas bloquer le pilote.

- [ ] **Rappels WhatsApp** : restent en mode manuel (bouton `wa.me` pré-rempli).
      Pas d'intégration API pour le moment.
- [ ] **Tutos vidéo** : indisponibles pour le pilote, contenus placeholder laissés
      tels quels.

### Étape 4 — Canal de remontée unique

- [ ] Mettre en place **un seul canal de remontée** (WhatsApp ou email dédié)
      centralisant les bugs ET les réponses au questionnaire.
- [ ] Séquencement par risque : ouvrir d'abord à 1–2 agences en avance de phase
      (2–3 semaines), puis aux autres. Le marché de Dakar est restreint : une
      mauvaise expérience circule vite.

### Étape 5 — Sélection des 4 agences

- [ ] Identifier 4 agences selon les critères de la section 3.

### Étape 6 — Accompagnement

- [ ] Rédiger une fiche de prise en main simple.
- [ ] Identifier un interlocuteur unique côté agence (idéalement le gérant).
- [ ] Cadrer l'accord : accès gratuit sur la saison contre 3 points de feedback.

---

## 3. Critères de sélection des 4 agences

### Profils différenciés (couvrir des profils différents, pas les 3 plus grosses)

1. **Agence à l'aise avec le digital** (Excel ou outil basique) — feedback rapide
   et structuré.
2. **Agence papier / WhatsApp pur** — révèle les frictions réelles d'adoption.
3. **Agence de taille moyenne avec plusieurs agents** — teste le multi-utilisateur.
4. **À définir** — ex. plus grosse agence, ou agence à cheval sur Hajj + Omra.

### Critère d'exclusion

- Agences de moins de **20 pèlerins par an** : volume insuffisant pour stresseur
  réellement le module de paiement.

### Pondération

| Critère | Poids |
|---|---|
| Volume annuel de pèlerins (> 20/an) | Fort |
| Maturité digitale | Moyen |
| Stabilité (gérant identifié, interlocuteur unique) | Fort |
| Disposition à donner un feedback structuré | Fort |

---

## 4. Questionnaire de feedback structuré

3 points dans la saison : **+2 semaines**, **mi-saison**, **fin de saison**.

### Rubriques communes

1. **Première impression** — Qu'est-ce qui vous a marqué en bien/mal ?
2. **Usage quotidien** :
   - Dossier pèlerin (documents, statuts) : clair et rapide ?
   - Paiements échelonnés : le calcul du reste dû est-il juste et compréhensible ?
   - Rappels WhatsApp : utilisés ? utiles ? problèmes rencontrés ?
3. **Ergonomie mobile** — Utilisez-vous l'outil depuis le téléphone ? Fluide ou non ?
4. **Bugs rencontrés** — Liste des dysfonctionnements constatés.
5. **Utilité réelle vs promesse** — L'outil résout-il le problème de départ
   (ne plus perdre le fil des paiements / dossiers) ?
6. **Volonté de payer** — Payeriez-vous pour cet outil ? Quel prix mensuel ou
   par saison serait acceptable ?
7. **Note globale /10** — et une phrase pour justifier.

### Fin de saison (en plus)

- Qu'est-ce qui manque pour remplacer définitivement Excel/cahier/WhatsApp ?
- Recommanderiez-vous l'outil à une autre agence ?

---

## 5. Canal de remontée unique

- Un canal dédié (WhatsApp ou email) utilisé pour : signaler les bugs, répondre
  au questionnaire, échanger pendant l'accompagnement.
- Toute remontée est centralisée ici ; pas de suivi séparé.
- Le canal sert de référence pour consolider les retours à chaque point de feedback.

## Évolutions post-feedback

À trancher une fois les retours des 4 agences recueillis :

- Intégration de l'API WhatsApp pour l'envoi automatique des rappels.
- Production des tutos vidéo.
- Décision tarifaire (abonnement annuel ou palier par volume de pèlerins).
