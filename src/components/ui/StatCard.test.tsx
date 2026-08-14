import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatCard from './StatCard'

describe('StatCard', () => {
  it('affiche une valeur monétaire compacte : une ligne, unité réduite', () => {
    render(<StatCard label="Total encaissé" valeur={5120000000} icon="payments" tone="gold" grande monetaire />)
    const montant = screen.getByText('5 120 000 000')
    expect(montant).toBeInTheDocument()
    expect(screen.getByText('FCFA')).toBeInTheDocument()
    expect(montant.closest('h3')?.className).toContain('text-headline-md')
  })

  it('rend le slot actions', () => {
    render(
      <StatCard label="Total" valeur={1} icon="payments" actions={<button type="button">Filtre</button>} />
    )
    expect(screen.getByRole('button', { name: 'Filtre' })).toBeInTheDocument()
  })

  it('affiche le suffixe de tendance par défaut', () => {
    render(<StatCard label="Pèlerins" valeur={5} icon="group" tendance={{ texte: '3 dossiers validés', positif: true }} />)
    expect(screen.getByText('cette semaine')).toBeInTheDocument()
  })

  it('masque le suffixe de tendance quand il est vide', () => {
    render(<StatCard label="Pèlerins" valeur={5} icon="group" tendance={{ texte: "aujourd'hui", positif: true, suffixe: '' }} />)
    expect(screen.getByText("aujourd'hui")).toBeInTheDocument()
    expect(screen.queryByText('cette semaine')).not.toBeInTheDocument()
  })
})