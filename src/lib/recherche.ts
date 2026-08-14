export function filtrerRecherche<T extends { libelle: string; sousLibelle: string }>(
  terme: string,
  items: T[],
  limite = 5
): T[] {
  const t = terme.trim().toLowerCase()
  if (!t) return []
  return items
    .filter((i) => i.libelle.toLowerCase().includes(t) || i.sousLibelle.toLowerCase().includes(t))
    .slice(0, limite)
}