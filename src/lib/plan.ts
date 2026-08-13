export interface TrancheDraft {
  numero_tranche: number
  montant_prevu: number
  date_echeance: string
}

export function genererTranches(
  montantTotal: number,
  nombreTranches: number,
  premiereEcheance: string
): TrancheDraft[] {
  if (nombreTranches < 1) return []
  const base = Math.floor(montantTotal / nombreTranches)
  const tranches: TrancheDraft[] = []
  for (let i = 1; i <= nombreTranches; i++) {
    const dernier = i === nombreTranches
    tranches.push({
      numero_tranche: i,
      montant_prevu: dernier ? montantTotal - base * (nombreTranches - 1) : base,
      date_echeance: premiereEcheance,
    })
  }
  return tranches
}