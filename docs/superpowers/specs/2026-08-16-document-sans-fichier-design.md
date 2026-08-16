# Design — Valider un document sans téléverser de fichier

Date : 2026-08-16

## Objectif

Permettre au gérant/agent de valider un document de dossier pèlerin **sans téléverser de fichier**, car certaines agences ne disposent pas de dispositif de numérisation. La validation crée la ligne document directement au statut « validé », sans fichier joint.

## Approche retenue

Réutilisation du upsert existant (`onConflict: 'pelerin_id,type_document'`) : il ne modifie que les colonnes fournies, donc un fichier déjà présent sur la ligne est préservé. Aucun changement SQL ni schéma : le champ `fichier_url` reste nul et l'UI existante affiche déjà « Aucun fichier ».

## Conception

### 1. Fonction partagée — `src/lib/documents.ts`

Ajouter :

```ts
export async function validerSansFichier(agenceId: string, pelerinId: string, typeDocument: string) {
  const { error } = await supabase.from('documents').upsert(
    {
      agence_id: agenceId,
      pelerin_id: pelerinId,
      type_document: typeDocument,
      statut: 'valide',
      date_upload: new Date().toISOString(),
    },
    { onConflict: 'pelerin_id,type_document' }
  )
  if (error) throw error
}
```

Import de `supabase` dans ce fichier. C'est la seule source de vérité pour les deux pages.

### 2. Fiche pèlerin — `src/components/documents/DocumentSection.tsx`

À côté du bouton « Téléverser un fichier », ajouter un bouton « Valider sans fichier » (icône `verified`, variant secondaire). Il utilise le select de type déjà présent (`typeChoisi.current`) et le `pelerinId` de la page. Mutation : `useMutation` autour de `validerSansFichier(agence.id, pelerinId, typeChoisi.current)`, invalidation de `['documents', pelerinId]` et `['pelerin', pelerinId]` en success. Pas d'UI d'erreur (pattern existant de `majStatut`).

### 3. Gestion des documents — `src/pages/Documents.tsx`

En haut de la page, sous la barre des filtres, un formulaire compact :
- **select Pèlerin** : requête `supabase.from('pelerins').select('id, prenom, nom')` (RLS : agence courante), triée par `nom`, option vide « Choisir un pèlerin ».
- **select Type** : les libellés existants (`LIBELLES_DOCUMENT`), défaut « passeport ».
- **bouton « Valider sans fichier »** : mutation `validerSansFichier`, désactivé tant qu'aucun pèlerin n'est choisi et pendant l'envoi. Success : invalidation de `['documents-tous']` et `['pelerins']`, remise à zéro du select pèlerin.

### 4. Tests

- `src/lib/documents.test.ts` : `validerSansFichier` appelle `upsert` avec les bons champs (statut `valide`, pas de `fichier_url`) et propage l'erreur.
- Nouveau `src/components/documents/DocumentSection.test.tsx` : mock de `../lib/supabase` et du hook `../../hooks/useAgence` ; le clic sur « Valider sans fichier » déclenche l'upsert.
- Nouveau `src/pages/Documents.test.tsx` : mock de `../lib/supabase` ; le choix d'un pèlerin + clic « Valider sans fichier » déclenche l'upsert avec l'id du pèlerin choisi.

Conventions : vitest + testing-library, mock `vi.hoisted`, `QueryClientProvider`, `MemoryRouter` pour les pages rendant des `Link`.

## Fichiers touchés

| Fichier | Action |
|---|---|
| `src/lib/documents.ts` | + `validerSansFichier` |
| `src/lib/documents.test.ts` | + test |
| `src/components/documents/DocumentSection.tsx` | + bouton |
| `src/components/documents/DocumentSection.test.tsx` | nouveau |
| `src/pages/Documents.tsx` | + formulaire |
| `src/pages/Documents.test.tsx` | nouveau |

Aucun changement SQL. Vérifications : `npm test`, `npm run lint`, `npm run build`.