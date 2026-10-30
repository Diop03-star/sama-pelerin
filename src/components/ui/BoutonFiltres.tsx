interface BoutonFiltresProps {
  ouverts: boolean
  actifs: number
  controle: string
  onClick: () => void
}

// Visible sur téléphone uniquement : les filtres y sont repliés pour laisser la place à la liste.
export default function BoutonFiltres({ ouverts, actifs, controle, onClick }: BoutonFiltresProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={ouverts}
      aria-controls={controle}
      className={`flex h-11 shrink-0 items-center gap-2 rounded-lg border px-3 text-body-md font-medium md:hidden ${
        ouverts || actifs > 0
          ? 'border-primary bg-primary text-on-primary'
          : 'border-outline-variant bg-surface text-on-surface'
      }`}
    >
      Filtres
      {actifs > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-on-primary px-1 text-label-md text-primary">
          {actifs}
        </span>
      )}
    </button>
  )
}
