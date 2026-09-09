# Améliorations Landing Page — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Résoudre les 5 retours utilisateur sur la landing : preuve sociale crédible (2 témoignages réels), rythme visuel (fonds alternés, tarifs en navy), bande sécurité des données, tarif dégressif mis en avant, aperçu tutoriels avec cartes placeholder.

**Architecture:** Toutes les modifications se font dans `src/pages/Landing.tsx` (constantes de données + JSX des sections) et `src/pages/Landing.test.tsx` (tests Vitest + Testing Library). Aucun nouveau fichier, aucune nouvelle dépendance.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, Tailwind CSS 4 (tokens `@theme` de `src/index.css`), Vitest + Testing Library.

**Spec :** `docs/superpowers/specs/2026-09-09-landing-ameliorations-design.md`

## Global Constraints

- Tous les libellés en français avec apostrophe typographique `’` (copier-coller exact depuis ce plan).
- Utiliser uniquement les tokens du design system (`src/index.css` `@theme`) : `bg-primary`, `bg-secondary-fixed`, `bg-secondary-container`, `text-on-primary`, `text-on-primary-container`, `text-on-secondary-fixed-variant`, `text-on-secondary-container`, `border-secondary-fixed-dim`, `text-vert`, `rounded-card`, `text-display-lg`, `text-headline-*`, `text-body-*`, `text-label-md`. Les dégradés `bg-gradient-to-*` sont déjà utilisés dans le codebase (ex. `src/pages/PelerinDetail.tsx:141`).
- NE PAS supprimer les `id` existants : `id="avantages"`, `id="tarifs"`, `id="tutoriels"`, `id="contact"` — la nav de `src/components/layout/PublicLayout.tsx:27-30` y fait référence (`/#avantages`, `/#tarifs`, `/#contact`).
- Aucun nouveau fichier, aucune nouvelle dépendance, aucune modification Supabase/routing.
- Tests : un `QueryClient` neuf par rendu (évite le cache inter-tests), données mockées via un helper `simulerTutos()`.
- Textes d'UI interdits : aucun engagement réglementaire (pas de « RGPD »), pas de nom d'hébergeur.

---

### Task 1: Témoignages — 2 réels + bandeau « Agences pilotes »

**Files:**
- Modify: `src/pages/Landing.tsx` (constante `TEMOIGNAGES` lignes 33-37, section témoignages lignes 154-167)
- Test: `src/pages/Landing.test.tsx`

**Interfaces:**
- Consumes: rien (autonome).
- Produces: constante `TEMOIGNAGES` à 2 entrées (type implicite `{ nom: string; ville: string; texte: string }[]`) — les tâches suivantes ne dépendent pas de ce format.

- [ ] **Step 1: Write the failing test**

Dans `src/pages/Landing.test.tsx`, ajouter dans `describe('Landing', ...)` après le test `'affiche les sections avantages et tarifs'` :

```tsx
  it('n’affiche que les deux témoignages réels', () => {
    rendre()
    expect(screen.getByText('Al Hidjah Travel')).toBeInTheDocument()
    expect(screen.getByText('Voyages Al-Barakah')).toBeInTheDocument()
    expect(screen.queryByText('Agence pilote 3')).not.toBeInTheDocument()
    expect(screen.getByText('Agences pilotes — Dakar')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/Landing.test.tsx`
Expected: FAIL — « Agence pilote 3 » est encore rendu (`queryByText` le trouve) et « Agences pilotes — Dakar » n'existe pas.

- [ ] **Step 3: Write minimal implementation**

Dans `src/pages/Landing.tsx`, remplacer la constante `TEMOIGNAGES` (3 entrées) par :

```tsx
const TEMOIGNAGES = [
  { nom: 'Al Hidjah Travel', ville: 'Dakar', texte: '« Nous suivons enfin chaque tranche sans erreur. Les familles savent exactement où elles en sont. »' },
  { nom: 'Voyages Al-Barakah', ville: 'Dakar', texte: '« Les rappels WhatsApp nous ont libérés de la relance manuelle. Un gain de temps énorme. »' },
]
```

Puis remplacer toute la section témoignages (actuellement fond blanc, grille 3 colonnes) par :

```tsx
      <section className="bg-surface-container-low py-16">
        <div className="mx-auto w-full max-w-6xl px-4">
          <h2 className="text-headline-md font-bold text-primary">Ils nous font confiance</h2>
          <span className="mt-8 inline-block rounded-full bg-secondary-container px-3 py-1 text-label-md text-on-secondary-container">
            Agences pilotes — Dakar
          </span>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            {TEMOIGNAGES.map((t) => (
              <figure key={t.nom} className="rounded-card border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
                <blockquote className="text-body-md text-on-surface">{t.texte}</blockquote>
                <figcaption className="mt-4 text-label-md font-semibold text-primary">{t.nom}</figcaption>
                <p className="text-label-md text-on-surface-variant">{t.ville}</p>
              </figure>
            ))}
          </div>
        </div>
      </section>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/Landing.test.tsx`
Expected: PASS (tous les tests du fichier).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Landing.tsx src/pages/Landing.test.tsx
git commit -m "feat(landing): preuve sociale - 2 temoignages reels + bandeau pilotes"
```

---

### Task 2: Bande sécurité des données

**Files:**
- Modify: `src/pages/Landing.tsx` (nouvelle constante `SECURITE` + nouvelle section insérée entre la section témoignages et la section contact `id="contact"`)
- Test: `src/pages/Landing.test.tsx`

**Interfaces:**
- Consumes: `Icon` (déjà importé dans Landing.tsx).
- Produces: constante `SECURITE` (`{ icon: string; titre: string; texte: string }[]`), section insérée avant `<section id="contact">` — Task 3 et Task 4 insèrent/modifient d'autres sections et ne doivent pas déplacer celle-ci.

- [ ] **Step 1: Write the failing test**

Dans `src/pages/Landing.test.tsx`, ajouter après le test des témoignages :

```tsx
  it('affiche la bande sécurité avec ses trois garanties', () => {
    rendre()
    expect(screen.getByText('Vos données, prises au sérieux')).toBeInTheDocument()
    expect(screen.getByText('Chiffré en transit')).toBeInTheDocument()
    expect(screen.getByText('Accès cloisonné')).toBeInTheDocument()
    expect(screen.getByText('Hébergement sécurisé')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/Landing.test.tsx`
Expected: FAIL — « Vos données, prises au sérieux » introuvable.

- [ ] **Step 3: Write minimal implementation**

Dans `src/pages/Landing.tsx`, ajouter la constante après `TEMOIGNAGES` :

```tsx
const SECURITE = [
  { icon: 'lock', titre: 'Chiffré en transit', texte: 'Toutes les communications passent en HTTPS.' },
  { icon: 'verified_user', titre: 'Accès cloisonné', texte: 'Chaque agence ne voit que ses propres données.' },
  { icon: 'cloud_done', titre: 'Hébergement sécurisé', texte: 'Données sauvegardées et accessibles toute l’année, même hors saison.' },
]
```

Puis insérer cette section immédiatement APRÈS la section témoignages (fond gris) et AVANT `<section id="contact" className="bg-primary py-16">` :

```tsx
      <section className="bg-secondary-container/40 py-12">
        <div className="mx-auto w-full max-w-6xl px-4">
          <h2 className="text-headline-md font-bold text-primary">Vos données, prises au sérieux</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {SECURITE.map((s) => (
              <div key={s.titre} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-primary">
                  <Icon name={s.icon} size={20} />
                </div>
                <div>
                  <h3 className="text-headline-sm font-bold text-primary">{s.titre}</h3>
                  <p className="mt-1 text-body-md text-on-surface-variant">{s.texte}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/Landing.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Landing.tsx src/pages/Landing.test.tsx
git commit -m "feat(landing): bande securite des donnees"
```

---

### Task 3: Tarifs — fond navy, 2 cartes, tarif dégressif en avant

**Files:**
- Modify: `src/pages/Landing.tsx` (section `id="tarifs"` — garder l'id ! — lignes 97-133)
- Test: `src/pages/Landing.test.tsx`

**Interfaces:**
- Consumes: constantes `PALIERS` et `TRAITS_TARIF` existantes (inchangées), `Icon`, `whatsappDemoUrl()`.
- Produces: rien (section autonome). Le bloc « Tarif dégressif » est retiré de la carte principale ; `PALIERS` reste la source des 2 paliers.

- [ ] **Step 1: Write the failing test**

Dans `src/pages/Landing.test.tsx`, ajouter après le test de la bande sécurité :

```tsx
  it('affiche le tarif dégressif comme argument de closing', () => {
    rendre()
    expect(screen.getByText('Plus vous inscrivez de pèlerins, moins vous payez par pèlerin.')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/Landing.test.tsx`
Expected: FAIL — la phrase n'existe pas encore.

- [ ] **Step 3: Write minimal implementation**

Dans `src/pages/Landing.tsx`, remplacer TOUTE la section `<section id="tarifs" ...>` (de la balise ouvrante à la fermante) par :

```tsx
      <section id="tarifs" className="bg-primary py-16">
        <div className="mx-auto w-full max-w-6xl px-4">
          <h2 className="text-headline-md font-bold text-on-primary">Tarifs simples et adaptés</h2>
          <p className="mt-2 text-body-lg text-on-primary-container">
            Payez selon votre activité : 1 500 FCFA par pèlerin inscrit. Sans abonnement mensuel.
          </p>
          <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
            <div className="flex flex-col rounded-card bg-surface-container-lowest p-6 shadow-sm">
              <h3 className="text-headline-sm font-bold text-primary">À l’usage</h3>
              <p className="mt-3 text-display-lg font-bold text-primary">
                1 500 FCFA
                <span className="text-body-md font-normal text-on-surface-variant"> /pèlerin inscrit</span>
              </p>
              <ul className="mt-6 flex-1 space-y-3 text-body-md text-on-surface-variant">
                {TRAITS_TARIF.map((trait) => (
                  <li key={trait} className="flex items-start gap-2">
                    <Icon name="check_circle" size={18} className="mt-0.5 text-vert" />
                    {trait}
                  </li>
                ))}
              </ul>
              <a href={whatsappDemoUrl()} target="_blank" rel="noreferrer" className="btn-primary mt-8 px-4 py-2.5 text-center">
                Demander une démo
              </a>
            </div>
            <div className="flex flex-col rounded-card bg-secondary-fixed p-6 shadow-sm">
              <h3 className="text-headline-sm font-bold text-on-secondary-fixed-variant">Tarif dégressif</h3>
              <p className="mt-2 text-body-md text-on-secondary-fixed-variant">
                Plus vous inscrivez de pèlerins, moins vous payez par pèlerin.
              </p>
              <div className="mt-6 flex-1 space-y-4">
                {PALIERS.map((p) => (
                  <div key={p.seuil} className="border-b border-secondary-fixed-dim pb-4 last:border-0 last:pb-0">
                    <p className="text-label-md text-on-secondary-fixed-variant">{p.seuil}</p>
                    <p className="mt-1 text-display-lg font-bold text-primary">{p.prix}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/Landing.test.tsx`
Expected: PASS — y compris le test existant `'affiche les sections avantages et tarifs'` (« 1 500 FCFA », « 1 000 FCFA », « 750 FCFA » toujours présents) et `'affiche les boutons WhatsApp de demande de démo'` (2 liens `wa.me` : carte tarifs + section contact).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Landing.tsx src/pages/Landing.test.tsx
git commit -m "feat(landing): tarifs sur fond navy + tarif degressif mis en avant"
```

---

### Task 4: Aperçu tutoriels placeholders + fond de la section

**Files:**
- Modify: `src/pages/Landing.tsx` (constante `TUTOS_EXEMPLE` + section `id="tutoriels"` — garder l'id !)
- Test: `src/pages/Landing.test.tsx` (refactor `rendre()` / ajout `simulerTutos()` + 2 tests)

**Interfaces:**
- Consumes: `Icon`, `Link` (déjà importés), requête `tutos` existante (`useQuery` clé `'tutos-preview'`).
- Produces: helper de test `simulerTutos(data: Tutos[])` réutilisable ; constante `TUTOS_EXEMPLE` de forme `{ titre: string }[]`.

- [ ] **Step 1: Write the failing tests + refactor du harnais de test**

Dans `src/pages/Landing.test.tsx` :

1. Renommer le titre du tuto mocké pour éviter toute collision avec un titre de placeholder (sinon `findByText` peut matcher la carte placeholder pendant le chargement) — dans `tutosPreview`, remplacer `titre: 'Créer un plan de paiement'` par `titre: 'Suivre les encaissements d’une campagne'` :

```tsx
const tutosPreview: Tutos[] = [
  {
    id: 't1', titre: 'Suivre les encaissements d’une campagne', description: 'Étape par étape',
    url_youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', ordre: 1, actif: true,
    created_at: '2026-08-01T00:00:00Z',
  },
]
```

2. Supprimer la constante module-level `const queryClient = new QueryClient()` (ligne 14) et remplacer la fonction `rendre()` par une version avec client neuf à chaque rendu :

```tsx
function rendre() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    </QueryClientProvider>
  )
}
```

3. Ajouter le helper juste après `rendre()` (avant `beforeEach`) et simplifier `beforeEach` :

```tsx
function simulerTutos(data: Tutos[]) {
  mockSupabase.from.mockImplementation((table: string) => {
    if (table !== 'tutos') return {}
    return {
      select: () => ({
        eq: () => ({
          order: () => ({ limit: () => Promise.resolve({ data, error: null }) }),
        }),
      }),
    }
  })
}

beforeEach(() => {
  mockSupabase.from.mockReset()
  simulerTutos(tutosPreview)
})
```

4. Modifier le test existant `'affiche l’aperçu des tutoriels avec le lien vers la galerie'` pour attendre le NOUVEAU titre mocké et vérifier l'absence de badge quand les vrais tutos existent (attention : pendant le chargement `tutos` vaut `[]` donc les placeholders s'affichent brièvement — attendre le vrai tuto AVANT d'affirmer l'absence) :

```tsx
  it('affiche l’aperçu des tutoriels avec le lien vers la galerie', async () => {
    rendre()
    expect(await screen.findByText('Suivre les encaissements d’une campagne')).toBeInTheDocument()
    expect(screen.queryByText('Aperçu')).not.toBeInTheDocument()
    const lien = screen.getByText('Voir tous les tutoriels').closest('a')
    expect(lien).toHaveAttribute('href', '/tutoriels')
  })
```

5. Ajouter le nouveau test (dans `describe`, après le test précédent) :

```tsx
  it('affiche trois cartes d’aperçu quand aucun tuto n’est publié', async () => {
    simulerTutos([])
    rendre()
    const badges = await screen.findAllByText('Aperçu')
    expect(badges).toHaveLength(3)
    const carte = screen.getByText('Suivre les documents d’un pèlerin').closest('a')
    expect(carte).toHaveAttribute('href', '/tutoriels')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/Landing.test.tsx`
Expected: FAIL — le nouveau test « trois cartes d’aperçu » échoue (aucune carte placeholder rendue) ; le test existant avec `queryByText('Aperçu')` peut passer ou échouer selon le timing mais doit finir par PASS après implémentation.

- [ ] **Step 3: Write minimal implementation**

Dans `src/pages/Landing.tsx`, ajouter la constante après `SECURITE` :

```tsx
const TUTOS_EXEMPLE = [
  { titre: 'Créer votre agence et inviter vos agents' },
  { titre: 'Créer un plan de paiement' },
  { titre: 'Suivre les documents d’un pèlerin' },
]
```

Puis remplacer toute la section `<section id="tutoriels" className="bg-surface-container-low py-16">...</section>` par (fond redevient clair — la section hérite de `bg-surface` du layout) :

```tsx
      <section id="tutoriels" className="py-16">
        <div className="mx-auto w-full max-w-6xl px-4">
          <h2 className="text-headline-md font-bold text-primary">Apprenez à utiliser l’outil</h2>
          <p className="mt-2 text-body-lg text-on-surface-variant">
            Des tutoriels vidéo courts, en français, pour chaque fonctionnalité.
          </p>
          {tutos.length > 0 ? (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tutos.map((t) => (
                <CarteTuto key={t.id} tuto={t} />
              ))}
            </div>
          ) : (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {TUTOS_EXEMPLE.map((t) => (
                <Link
                  key={t.titre}
                  to="/tutoriels"
                  className="group block overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm transition-all hover:shadow-md"
                >
                  <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-primary via-navy-light to-secondary">
                    <span className="text-secondary-container transition-transform group-hover:scale-110">
                      <Icon name="play_circle" size={56} />
                    </span>
                    <span className="absolute left-3 top-3 rounded-full bg-secondary-fixed px-2 py-0.5 text-label-md text-on-secondary-fixed-variant">
                      Aperçu
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="text-headline-sm font-bold text-primary">{t.titre}</h3>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <div className="mt-10 text-center">
            <Link to="/tutoriels" className="btn-secondary px-6 py-3">Voir tous les tutoriels</Link>
          </div>
        </div>
      </section>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/pages/Landing.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Landing.tsx src/pages/Landing.test.tsx
git commit -m "feat(landing): apercu tutoriels placeholders + rythme des fonds"
```

---

### Task 5: Vérification complète

**Files:**
- Verify only — aucun fichier à modifier si tout passe.

**Interfaces:**
- Consumes: tout le travail des Tasks 1-4.
- Produces: rien.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: toutes les suites PASS (aucune régression ailleurs : `PublicLayout`, vitrine, etc.).

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: 0 erreur. Si oxlint signale un souci dans les fichiers modifiés, corriger puis relancer.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: compilation TypeScript + Vite sans erreur.

- [ ] **Step 4: Commit (seulement si des correctifs ont été nécessaires)**

```bash
git add -A src
git commit -m "fix(landing): correctifs suite a la verification"
```

Si aucun correctif n'a été nécessaire, ne pas créer de commit vide.

---

## Ordre des fonds — état final attendu

Hero (surface) → Avantages (`bg-surface-container-low`) → **Tarifs (`bg-primary` navy)** → Tutoriels (surface, clair) → Témoignages (`bg-surface-container-low` gris) → **Sécurité (`bg-secondary-container/40` or doux)** → Contact (`bg-primary` navy).
