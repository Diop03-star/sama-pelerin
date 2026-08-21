# Renommage « Stitch Sama Pèlerin » → « SamaPèlerin » — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renommer la marque « Stitch Sama Pèlerin » en « SamaPèlerin » dans tout le produit, sauf les archives `docs/superpowers/`.

**Architecture:** Remplacements de chaînes mécaniques dans 15 fichiers (UI React, index.html, lib, package, README, commentaires SQL). Aucun changement de logique, de routes ou de tests.

**Tech Stack:** React 19, Vite 8, TypeScript, Tailwind v4, Supabase, Vitest.

## Global Constraints

- Écriture exacte affichée : **SamaPèlerin** (P majuscule, è accentué, collé).
- Nom npm : `sama-pelerin` (minuscules, sans accent — convention npm).
- `docs/superpowers/**` : **inchangé** (archives historiques).
- Aucune modification de logique métier, de routes, de types ou de tests.
- Vérifications finales : `npm run test` (129 tests PASS), `npm run build`, `npm run lint`, grep « Stitch » sans résultat hors `docs/superpowers/`.
- Méthode d'édition : pour chaque fichier, remplacer TOUTES les occurrences de la chaîne `Stitch Sama Pèlerin` par `SamaPèlerin` (le fichier `package.json`/`package-lock.json` utilise sa propre chaîne, voir Task 2).

---

### Task 1: Renommage UI (src/ + index.html)

**Files:**
- Modify: `index.html` (ligne 7)
- Modify: `src/pages/Login.tsx` (ligne 33)
- Modify: `src/pages/Signup.tsx` (ligne 42)
- Modify: `src/pages/Onboarding.tsx` (ligne 59)
- Modify: `src/components/layout/Sidebar.tsx` (ligne 56)
- Modify: `src/components/layout/Topbar.tsx` (ligne 84)
- Modify: `src/components/layout/SuperAdminLayout.tsx` (ligne 38)
- Modify: `src/components/layout/PublicLayout.tsx` (3 occurrences : lignes 18, 42, 66)
- Modify: `src/pages/Landing.tsx` (3 occurrences : lignes 65, 77, 82)
- Modify: `src/pages/Tutoriels.tsx` (ligne 24)
- Modify: `src/lib/vitrine.ts` (ligne 2)
- Test: aucun test unitaire n'est affecté (aucun test ne référence le nom de marque — vérifié par grep)

**Interfaces:**
- Produces: plus aucune occurrence de « Stitch Sama Pèlerin » dans `src/` et `index.html` ; `MESSAGE_DEMO` de `src/lib/vitrine.ts` contient « SamaPèlerin ».

- [ ] **Step 1: Remplacer dans `index.html`**

`<title>Stitch Sama Pèlerin</title>` → `<title>SamaPèlerin</title>`

- [ ] **Step 2: Remplacer dans `src/pages/Login.tsx`**

`<h1 className="text-headline-sm font-bold text-primary">Stitch Sama Pèlerin</h1>` → le même avec `SamaPèlerin`.

- [ ] **Step 3: Remplacer dans `src/pages/Signup.tsx`**

`<h1 className="text-headline-sm font-bold text-primary">Stitch Sama Pèlerin</h1>` → `<h1 className="text-headline-sm font-bold text-primary">SamaPèlerin</h1>`

- [ ] **Step 4: Remplacer dans `src/pages/Onboarding.tsx`**

`<h1 className="text-headline-sm font-bold text-primary">Stitch Sama Pèlerin</h1>` → `<h1 className="text-headline-sm font-bold text-primary">SamaPèlerin</h1>`

- [ ] **Step 5: Remplacer dans `src/components/layout/Sidebar.tsx`**

`{agence?.nom ?? 'Stitch Sama Pèlerin'}` → `{agence?.nom ?? 'SamaPèlerin'}`

- [ ] **Step 6: Remplacer dans `src/components/layout/Topbar.tsx`**

`{agence?.nom ?? 'Stitch Sama Pèlerin'}` → `{agence?.nom ?? 'SamaPèlerin'}`

- [ ] **Step 7: Remplacer dans `src/components/layout/SuperAdminLayout.tsx`**

`<h1 className="text-headline-sm font-bold text-primary">Stitch Sama Pèlerin</h1>` → `<h1 className="text-headline-sm font-bold text-primary">SamaPèlerin</h1>`

- [ ] **Step 8: Remplacer dans `src/components/layout/PublicLayout.tsx`**

3 occurrences : `<span className="text-headline-sm font-bold text-primary">Stitch Sama Pèlerin</span>`, `<p className="text-headline-sm font-bold text-primary">Stitch Sama Pèlerin</p>` et `© {new Date().getFullYear()} Stitch Sama Pèlerin — Dakar, Sénégal` → remplacer toutes les occurrences de `Stitch Sama Pèlerin` par `SamaPèlerin`.

- [ ] **Step 9: Remplacer dans `src/pages/Landing.tsx`**

3 occurrences (texte hero, `alt="Aperçu de Stitch Sama Pèlerin"`, `Pourquoi Stitch Sama Pèlerin ?`) → remplacer toutes les occurrences de `Stitch Sama Pèlerin` par `SamaPèlerin`.

- [ ] **Step 10: Remplacer dans `src/pages/Tutoriels.tsx`**

`Apprenez à utiliser Stitch Sama Pèlerin, étape par étape.` → `Apprenez à utiliser SamaPèlerin, étape par étape.`

- [ ] **Step 11: Remplacer dans `src/lib/vitrine.ts`**

`export const MESSAGE_DEMO = 'Bonjour, je souhaite une démo de Stitch Sama Pèlerin.'` → `export const MESSAGE_DEMO = 'Bonjour, je souhaite une démo de SamaPèlerin.'`

- [ ] **Step 12: Vérifier par grep**

Run: `grep -rn "Stitch" src index.html` (ou outil équivalent)
Expected: 0 résultat.

- [ ] **Step 13: Commit**

```bash
git add -u src index.html
git commit -m "feat: renommage marque en SamaPèlerin (UI)"
```

---

### Task 2: Renommage hors UI (package, README, SQL)

**Files:**
- Modify: `package.json` (ligne 2)
- Modify: `package-lock.json` (lignes 2 et 8)
- Modify: `README.md` (ligne 1)
- Modify: `supabase/schema.sql` (ligne 2)
- Modify: `supabase/seed.sql` (ligne 2)
- Test: aucun test unitaire (vérification par grep)

**Interfaces:**
- Produces: `name: "sama-pelerin"` dans package.json/package-lock.json ; titres README et commentaires SQL sans « Stitch ».

- [ ] **Step 1: Remplacer dans `package.json`**

`"name": "stitch-sama-pelerin"` → `"name": "sama-pelerin"`

- [ ] **Step 2: Remplacer dans `package-lock.json`**

Les 2 occurrences de `"name": "stitch-sama-pelerin"` → `"name": "sama-pelerin"`.

- [ ] **Step 3: Remplacer dans `README.md`**

`# Stitch Sama Pèlerin — SaaS de gestion Hajj & Omra` → `# SamaPèlerin — SaaS de gestion Hajj & Omra`

- [ ] **Step 4: Remplacer dans `supabase/schema.sql`**

`-- SCHÉMA « Stitch Sama Pèlerin » — appliquer via SQL Editor` → `-- SCHÉMA « SamaPèlerin » — appliquer via SQL Editor`

- [ ] **Step 5: Remplacer dans `supabase/seed.sql`**

`-- SEED « Stitch Sama Pèlerin » — données de démonstration` → `-- SEED « SamaPèlerin » — données de démonstration`

- [ ] **Step 6: Vérifier par grep**

Run: `grep -rn "Stitch" package.json package-lock.json README.md supabase` (ou outil équivalent)
Expected: 0 résultat.

- [ ] **Step 7: Commit**

```bash
git add -u package.json package-lock.json README.md supabase
git commit -m "feat: renommage marque en SamaPèlerin (package, README, SQL)"
```

---

### Task 3: Validation finale

**Files:** aucun

- [ ] **Step 1: Vérifier qu'il ne reste aucune occurrence**

Run: `grep -rn "Stitch" --include="*" .` (ou outil équivalent) en excluant le répertoire `docs/superpowers/` (les plans/specs historiques sont volontairement inchangés).
Expected: uniquement des résultats dans `docs/superpowers/` et `node_modules/` éventuels.

- [ ] **Step 2: Lancer toute la suite de tests**

Run: `npm run test`
Expected: 22 fichiers, 129 tests PASS.

- [ ] **Step 3: Vérifier le build**

Run: `npm run build`
Expected: build OK (avertissement de taille de chunk toléré).

- [ ] **Step 4: Vérifier le lint**

Run: `npm run lint`
Expected: 1 warning préexistant (AuthContext) et 0 erreur.

- [ ] **Step 5: Vérifier en live**

Le serveur `npm run dev` étant déjà lancé : recharger http://localhost:5173, vérifier que le titre de l'onglet, la landing et `/login` affichent « SamaPèlerin ».

- [ ] **Step 6: Commit si un fichier modifié restait non commité**

```bash
git status
git add -A && git commit -m "chore: renommage SamaPèlerin (reliquats)"
```

(Ne commit que si `git status` montre des modifications ; sinon passer.)
