# SEO Landing Page — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre la landing indexable et partageable : head statique enrichi (description, OG/WhatsApp, canonical, JSON-LD), titres/metas par route via un hook maison, robots.txt + sitemap.xml, bannière OG 1200×630.

**Architecture:** Tout est rendu sans dépendance : tags statiques dans `index.html` (la partie lue par les crawlers sociaux sans JS), hook `useSeo` (~30 lignes) appliqué sur les 4 pages publiques, fichiers statiques dans `public/` (copiés tels quels par Vite), bannière PNG générée par script PowerShell System.Drawing.

**Tech Stack:** React 19, Vitest + Testing Library (renderHook), Tailwind CSS 4 (non concerné), PowerShell 5.1 + System.Drawing pour le PNG.

**Spec :** `docs/superpowers/specs/2026-09-12-seo-landing-design.md`

## Global Constraints

- URL canonique en dur partout : `https://sama-pelerin.diopelzo659.workers.dev/` (décision utilisateur — à remplacer si un domaine est acheté un jour).
- Description canonique (verbatim, ≈155 car.) :
  `Gérez vos pèlerins, leurs paiements échelonnés en FCFA et leurs dossiers (passeport, visa) depuis un seul outil. Rappels WhatsApp automatiques pour votre agence au Sénégal.`
- Title canonique (verbatim) : `SamaPèlerin — Logiciel de gestion pour agences de Hajj & Omra au Sénégal` — dans `index.html` l'esperluette s'écrit `&amp;` ; dans les chaînes JS des pages, `&` simple.
- AUCUNE dépendance npm nouvelle (pas de react-helmet-async).
- Textes français avec apostrophe typographique `’` dans les libellés UI ; les contenus SEO (meta description, JSON-LD) utilisent l'apostrophe droite `'` simple (crawlers).
- Données honnêtes uniquement : le JSON-LD reflète le tarif affiché (1 500 FCFA/pèlerin) ; les URLs OG pointent vers des fichiers qui existent dans `public/`.
- Vite copie `public/*` à la racine de `dist/` tels quels — rien à configurer pour robots.txt/sitemap.xml/og-image.png.
- `lang="fr"`, favicon, manifest, theme-color : inchangés.

---

### Task 1: Hook `useSeo` (TDD)

**Files:**
- Create: `src/lib/useSeo.ts`
- Test: `src/lib/useSeo.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `export default function useSeo({ title, description }: { title: string; description?: string }): void` — Task 3 l'importe par défaut depuis `../lib/useSeo`. Comportement : met à jour `document.title`, crée/met à jour les metas `description` (name), `og:title`, `og:description`, `og:url` (property) et le `link[rel="canonical"]` ; ne touche PAS la description si `description` est omis ; PAS de restauration au démontage (chaque page publique appelle le hook avec ses valeurs complètes).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import useSeo from './useSeo'

describe('useSeo', () => {
  beforeEach(() => {
    document.head.querySelectorAll('meta[name], meta[property], link[rel="canonical"]').forEach((el) => el.remove())
    document.title = ''
  })

  it('met à jour le titre, la description, les og:* et le canonical', () => {
    renderHook(() => useSeo({ title: 'Test SEO', description: 'Desc test' }))
    expect(document.title).toBe('Test SEO')
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Desc test')
    expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('Test SEO')
    expect(document.head.querySelector('meta[property="og:description"]')?.getAttribute('content')).toBe('Desc test')
    expect(document.head.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(window.location.href)
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(window.location.href)
  })

  it('met à jour les balises existantes et ne crée pas la description si absente', () => {
    renderHook(() => useSeo({ title: 'Test SEO', description: 'Desc test' }))
    renderHook(() => useSeo({ title: 'Second' }))
    expect(document.title).toBe('Second')
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Desc test')
    expect(document.head.querySelectorAll('meta[name="description"]').length).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/useSeo.test.ts`
Expected: FAIL — « Failed to resolve import "./useSeo" ».

- [ ] **Step 3: Write minimal implementation**

```ts
import { useEffect } from 'react'

function majMeta(attr: 'name' | 'property', nom: string, contenu: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${nom}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, nom)
    document.head.appendChild(el)
  }
  el.setAttribute('content', contenu)
}

export default function useSeo({ title, description }: { title: string; description?: string }) {
  useEffect(() => {
    document.title = title
    if (description) {
      majMeta('name', 'description', description)
      majMeta('property', 'og:description', description)
    }
    majMeta('property', 'og:title', title)
    majMeta('property', 'og:url', window.location.href)
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = window.location.href
  }, [title, description])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/useSeo.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/useSeo.ts src/lib/useSeo.test.ts
git commit -m "feat(seo): hook useSeo (titres et metas par route)"
```

---

### Task 2: `index.html` — head statique enrichi (TDD via test de contenu)

**Files:**
- Modify: `index.html` (head uniquement, lignes 3-11)
- Test: `src/lib/seo-static.test.ts` (nouveau — réutilisé par Tasks 4-5)

**Interfaces:**
- Consumes: rien (fichiers statiques).
- Produces: `src/lib/seo-static.test.ts` lit les fichiers avec `node:fs` ; Tasks 4 et 5 y ajoutent leurs `describe` en réutilisant la même constante `racine`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const racine = process.cwd()
const indexHtml = readFileSync(resolve(racine, 'index.html'), 'utf8')

describe('SEO — index.html', () => {
  it('contient le titre optimisé', () => {
    expect(indexHtml).toContain('SamaPèlerin — Logiciel de gestion pour agences de Hajj &amp; Omra au Sénégal')
  })

  it('contient la meta description', () => {
    expect(indexHtml).toContain('Gérez vos pèlerins, leurs paiements échelonnés en FCFA et leurs dossiers')
  })

  it('contient le canonical', () => {
    expect(indexHtml).toContain('rel="canonical" href="https://sama-pelerin.diopelzo659.workers.dev/"')
  })

  it('contient les balises Open Graph avec image absolue', () => {
    expect(indexHtml).toContain('property="og:image" content="https://sama-pelerin.diopelzo659.workers.dev/og-image.png"')
    expect(indexHtml).toContain('property="og:locale" content="fr_SN"')
    expect(indexHtml).toContain('property="og:type" content="website"')
  })

  it('contient les balises Twitter Card', () => {
    expect(indexHtml).toContain('name="twitter:card" content="summary_large_image"')
    expect(indexHtml).toContain('name="twitter:image"')
  })

  it('contient le JSON-LD SoftwareApplication', () => {
    expect(indexHtml).toContain('application/ld+json')
    expect(indexHtml).toContain('"@type": "SoftwareApplication"')
    expect(indexHtml).toContain('"price": "1500"')
    expect(indexHtml).toContain('"priceCurrency": "XOF"')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/seo-static.test.ts`
Expected: FAIL — les 6 tests échouent (contenus absents de `index.html`).

- [ ] **Step 3: Write minimal implementation**

Remplacer le `<head>` de `index.html` (garder `<!doctype html>`, `<html lang="fr">`, `<body>`, `<div id="root">`, `<script type="module" src="/src/main.tsx">`) par :

```html
<head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/pwa-icon-192.png" />
    <link rel="apple-touch-icon" href="/pwa-icon-192.png" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="theme-color" content="#09152e" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>SamaPèlerin — Logiciel de gestion pour agences de Hajj &amp; Omra au Sénégal</title>
    <meta name="description" content="Gérez vos pèlerins, leurs paiements échelonnés en FCFA et leurs dossiers (passeport, visa) depuis un seul outil. Rappels WhatsApp automatiques pour votre agence au Sénégal." />
    <link rel="canonical" href="https://sama-pelerin.diopelzo659.workers.dev/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="SamaPèlerin" />
    <meta property="og:title" content="SamaPèlerin — Logiciel de gestion pour agences de Hajj &amp; Omra au Sénégal" />
    <meta property="og:description" content="Gérez vos pèlerins, leurs paiements échelonnés en FCFA et leurs dossiers (passeport, visa) depuis un seul outil. Rappels WhatsApp automatiques pour votre agence au Sénégal." />
    <meta property="og:url" content="https://sama-pelerin.diopelzo659.workers.dev/" />
    <meta property="og:image" content="https://sama-pelerin.diopelzo659.workers.dev/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="SamaPèlerin — l'outil des agences de Hajj &amp; Omra" />
    <meta property="og:locale" content="fr_SN" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="SamaPèlerin — Logiciel de gestion pour agences de Hajj &amp; Omra au Sénégal" />
    <meta name="twitter:description" content="Gérez vos pèlerins, leurs paiements échelonnés en FCFA et leurs dossiers (passeport, visa) depuis un seul outil. Rappels WhatsApp automatiques pour votre agence au Sénégal." />
    <meta name="twitter:image" content="https://sama-pelerin.diopelzo659.workers.dev/og-image.png" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "SamaPèlerin",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web",
        "url": "https://sama-pelerin.diopelzo659.workers.dev/",
        "description": "Gérez vos pèlerins, leurs paiements échelonnés en FCFA et leurs dossiers (passeport, visa) depuis un seul outil. Rappels WhatsApp automatiques pour votre agence au Sénégal.",
        "inLanguage": "fr",
        "offers": {
          "@type": "Offer",
          "price": "1500",
          "priceCurrency": "XOF"
        }
      }
    </script>
</head>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/seo-static.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add index.html src/lib/seo-static.test.ts
git commit -m "feat(seo): head statique enrichi (description, og, canonical, json-ld)"
```

---

### Task 3: Application du hook sur les pages publiques

**Files:**
- Modify: `src/pages/Tutoriels.tsx` (ajout import + 1er appel dans le composant)
- Modify: `src/pages/Login.tsx` (idem)
- Modify: `src/pages/Signup.tsx` (idem)
- Modify: `src/pages/Landing.tsx` (idem)
- Test: `src/pages/Tutoriels.test.tsx`, `src/pages/Login.test.tsx`, `src/pages/Signup.test.tsx`, `src/pages/Landing.test.tsx`

**Interfaces:**
- Consumes: `useSeo` de Task 1 (import par défaut : `import useSeo from '../lib/useSeo'`).
- Produces: rien (pages autonomes).

- [ ] **Step 1: Write the failing tests**

Dans chaque fichier de test, ajouter un petit test dédié en utilisant la fonction d'aide existante du fichier (`rendre()` ou `render(...)` avec les providers requis — adapter à ce qui existe) :

```tsx
  it('affiche son titre SEO', () => {
    rendre()
    expect(document.title).toBe('TITRE-ATTENDU')
  })
```

Valeurs `TITRE-ATTENDU` :
- `Tutoriels.test.tsx` : `Tutoriels vidéo — SamaPèlerin`
- `Login.test.tsx` : `Connexion — SamaPèlerin`
- `Signup.test.tsx` : `Essayer gratuitement — SamaPèlerin`
- `Landing.test.tsx` : `SamaPèlerin — Logiciel de gestion pour agences de Hajj & Omra au Sénégal`

REMARQUE : les tests de chaque page montent la page sans démontage immédiat ; RTL démonte à la fin de chaque test. Comme `useSeo` ne restaure rien, le titre reste fixé après chaque test — sans effet sur les assertions existantes (aucune ne lit `document.title`). Pour rester déterministe, ajouter ce bloc au `beforeEach` existant de chaque fichier de test (ou créer le bloc s'il n'existe pas) :

```tsx
  beforeEach(() => {
    // ... le beforeEach existant reste intact, on ajoute à la fin :
    document.title = ''
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/Tutoriels.test.tsx src/pages/Login.test.tsx src/pages/Signup.test.tsx src/pages/Landing.test.tsx`
Expected: FAIL — les 4 nouveaux tests (titre vide ou autre).

- [ ] **Step 3: Write minimal implementation**

Dans chaque page, ajouter l'import puis l'appel comme PREMIÈRE instruction du corps du composant :

`src/pages/Tutoriels.tsx` :
```tsx
import useSeo from '../lib/useSeo'

export default function Tutoriels() {
  useSeo({
    title: 'Tutoriels vidéo — SamaPèlerin',
    description: 'Tutoriels vidéo en français pour maîtriser SamaPèlerin : plans de paiement, documents, groupes et rappels WhatsApp.',
  })
  // ... reste inchangé
```

`src/pages/Login.tsx` :
```tsx
import useSeo from '../lib/useSeo'

export default function Login() {
  useSeo({ title: 'Connexion — SamaPèlerin' })
  // ... reste inchangé
```

`src/pages/Signup.tsx` :
```tsx
import useSeo from '../lib/useSeo'

export default function Signup() {
  useSeo({
    title: 'Essayer gratuitement — SamaPèlerin',
    description: 'Créez le compte de votre agence de pèlerinage et commencez à gérer vos dossiers, groupes et paiements sur SamaPèlerin.',
  })
  // ... reste inchangé
```

`src/pages/Landing.tsx` :
```tsx
import useSeo from '../lib/useSeo'

export default function Landing() {
  useSeo({
    title: 'SamaPèlerin — Logiciel de gestion pour agences de Hajj & Omra au Sénégal',
    description: 'Gérez vos pèlerins, leurs paiements échelonnés en FCFA et leurs dossiers (passeport, visa) depuis un seul outil. Rappels WhatsApp automatiques pour votre agence au Sénégal.',
  })
  const { session } = useAuth()
  // ... reste inchangé
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/pages/Tutoriels.test.tsx src/pages/Login.test.tsx src/pages/Signup.test.tsx src/pages/Landing.test.tsx`
Expected: PASS — tous les tests des 4 fichiers.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Tutoriels.tsx src/pages/Login.tsx src/pages/Signup.tsx src/pages/Landing.tsx src/pages/Tutoriels.test.tsx src/pages/Login.test.tsx src/pages/Signup.test.tsx src/pages/Landing.test.tsx
git commit -m "feat(seo): application du hook sur les pages publiques"
```

---

### Task 4: `robots.txt` + `sitemap.xml` (TDD via test de contenu)

**Files:**
- Create: `public/robots.txt`
- Create: `public/sitemap.xml`
- Test: `src/lib/seo-static.test.ts` (append 2 describe blocks)

**Interfaces:**
- Consumes: la constante `racine` de Task 2 dans `src/lib/seo-static.test.ts`.
- Produces: rien.

- [ ] **Step 1: Write the failing tests**

Ajouter à la FIN de `src/lib/seo-static.test.ts` (après le describe de `index.html`) :

```tsx
const robots = readFileSync(resolve(racine, 'public/robots.txt'), 'utf8')
const sitemap = readFileSync(resolve(racine, 'public/sitemap.xml'), 'utf8')

describe('SEO — robots.txt', () => {
  it('interdit les routes privées', () => {
    for (const route of ['/tableau-de-bord', '/membres', '/liste-des-groupes', '/liste-des-pelerins', '/details-du-pelerin', '/gestion-des-documents', '/paiements-echeanciers', '/onboarding', '/profil', '/superadmin', '/login']) {
      expect(robots).toContain(`Disallow: ${route}`)
    }
  })

  it('reference le sitemap', () => {
    expect(robots).toContain('Sitemap: https://sama-pelerin.diopelzo659.workers.dev/sitemap.xml')
  })
})

describe('SEO — sitemap.xml', () => {
  it('contient les deux pages publiques', () => {
    expect(sitemap).toContain('<loc>https://sama-pelerin.diopelzo659.workers.dev/</loc>')
    expect(sitemap).toContain('<loc>https://sama-pelerin.diopelzo659.workers.dev/tutoriels</loc>')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/seo-static.test.ts`
Expected: FAIL — `readFileSync` lève ENOENT (fichiers absents).

- [ ] **Step 3: Write minimal implementation**

`public/robots.txt` :
```
User-agent: *
Allow: /
Disallow: /tableau-de-bord
Disallow: /membres
Disallow: /liste-des-groupes
Disallow: /liste-des-pelerins
Disallow: /details-du-pelerin
Disallow: /gestion-des-documents
Disallow: /paiements-echeanciers
Disallow: /onboarding
Disallow: /profil
Disallow: /superadmin
Disallow: /login

Sitemap: https://sama-pelerin.diopelzo659.workers.dev/sitemap.xml
```

`public/sitemap.xml` :
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://sama-pelerin.diopelzo659.workers.dev/</loc>
    <lastmod>2026-09-12</lastmod>
  </url>
  <url>
    <loc>https://sama-pelerin.diopelzo659.workers.dev/tutoriels</loc>
    <lastmod>2026-09-12</lastmod>
  </url>
</urlset>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/seo-static.test.ts`
Expected: PASS — tous les tests du fichier (index.html + robots + sitemap).

- [ ] **Step 5: Commit**

```bash
git add public/robots.txt public/sitemap.xml src/lib/seo-static.test.ts
git commit -m "feat(seo): robots.txt et sitemap.xml"
```

---

### Task 5: Bannière `og-image.png` 1200×630 (script + test)

**Files:**
- Create: `scripts/generer-og-image.ps1` (script réexécutable, commité)
- Create: `public/og-image.png` (généré par le script)
- Test: `src/lib/seo-static.test.ts` (append 1 describe block)

**Interfaces:**
- Consumes: `public/pwa-icon-512.png` (existe).
- Produces: `public/og-image.png` — référencé par `index.html` (Task 2) ; re-exécutable si l'utilisateur remplace le design.

- [ ] **Step 1: Write the failing test**

Ajouter à la FIN de `src/lib/seo-static.test.ts` :

```tsx
describe('SEO — og-image.png', () => {
  it('existe en PNG 1200x630', () => {
    const chemin = resolve(racine, 'public/og-image.png')
    expect(existsSync(chemin)).toBe(true)
    const buf = readFileSync(chemin)
    expect(buf.subarray(1, 4).toString('latin1')).toBe('PNG')
    expect(buf.readUInt32BE(16)).toBe(1200)
    expect(buf.readUInt32BE(20)).toBe(630)
    expect(buf.length).toBeGreaterThan(10000)
  })
})
```

Adapter l'import de tête du fichier : `import { readFileSync, existsSync } from 'node:fs'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/seo-static.test.ts`
Expected: FAIL — og-image.png inexistant.

- [ ] **Step 3: Write minimal implementation**

`scripts/generer-og-image.ps1` :

```powershell
Add-Type -AssemblyName System.Drawing
$w = 1200; $h = 630
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'

# Fond navy #09152e
$g.Clear([System.Drawing.Color]::FromArgb(255, 9, 21, 46))

# Bande or #ffdeae en bas
$pinceauOr = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 222, 174))
$g.FillRectangle($pinceauOr, 0, $h - 24, $w, 24)

# Logo a gauche
$logo = [System.Drawing.Image]::FromFile((Join-Path $PSScriptRoot '..\public\pwa-icon-512.png'))
$g.DrawImage($logo, 80, ($h - 320) / 2, 320, 320)
$logo.Dispose()

# Titre
$policeTitre = New-Object System.Drawing.Font('Segoe UI', 66, [System.Drawing.FontStyle]::Bold)
$g.DrawString('SamaPèlerin', $policeTitre, [System.Drawing.Brushes]::White, 460, 200)
$policeTitre.Dispose()

# Tagline
$policeTag = New-Object System.Drawing.Font('Segoe UI', 30)
$pinceauTag = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 134, 145, 176))
$g.DrawString("L'outil des agences de Hajj & Omra", $policeTag, $pinceauTag, 462, 300)
$policeTag.Dispose()
$pinceauTag.Dispose()

$chemin = Join-Path $PSScriptRoot '..\public\og-image.png'
$bmp.Save($chemin, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "OG image generee: $chemin"
```

Exécuter : `powershell -ExecutionPolicy Bypass -File scripts/generer-og-image.ps1` (depuis la racine du repo ; aussi exécutable directement dans la session PowerShell).
Expected output : `OG image generee: ...\public\og-image.png`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/seo-static.test.ts`
Expected: PASS — tous les tests du fichier.

- [ ] **Step 5: Commit**

```bash
git add scripts/generer-og-image.ps1 public/og-image.png src/lib/seo-static.test.ts
git commit -m "feat(seo): banniere og-image 1200x630"
```

---

### Task 6: Vérification complète

**Files:**
- Verify only — aucun fichier à modifier si tout passe.

**Interfaces:**
- Consumes: tout le travail des Tasks 1-5.
- Produces: rien.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: toutes les suites PASS (≈204 tests : 188 actuels + 2 useSeo + 6 index.html + 2 robots + 1 sitemap + 1 og-image + 4 titres de pages).

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: 0 erreur (1 warning préexistant AuthContext toléré).

- [ ] **Step 3: Run build et inspecter le bundle**

Run: `npm run build`, puis :

```powershell
Select-String -Path dist/index.html -Pattern 'og:image', 'application/ld+json', 'canonical', 'meta name="description"'
Get-Item dist/robots.txt, dist/sitemap.xml, dist/og-image.png | Select-Object Name, Length
```

Expected: les 4 patterns présents dans `dist/index.html` ; les 3 fichiers présents dans `dist/` avec une taille > 0.

- [ ] **Step 4: Commit (seulement si des correctifs ont été nécessaires)**

```bash
git add -A src public index.html scripts
git commit -m "fix(seo): correctifs suite a la verification"
```

Si aucun correctif n'a été nécessaire, ne pas créer de commit vide.

---

## Limites connues (assumées, décisions utilisateur)

- Canonical = `workers.dev` (autorité de domaine faible). Si un domaine est acheté : remplacer l'URL dans `index.html`, `public/robots.txt`, `public/sitemap.xml` et re-exécuter le script OG si besoin.
- Google rend le JS : les metas par route du hook sont lues. Les crawlers sociaux ne voient que le head statique de `index.html` — c'est exactement ce que la Task 2 corrige.
- `robots.txt` est une directive (pas un verrou) : les routes privées ne contiennent de toute façon aucune donnée publique.
