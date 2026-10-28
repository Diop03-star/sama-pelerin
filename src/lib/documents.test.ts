import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  cheminFichierDocument,
  expirantDans,
  majMetadonnees,
  validerFichierDocument,
  validerSansFichier,
} from './documents'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('./supabase', () => ({ supabase: mockSupabase }))

function fichierDe(nom: string, type: string, taille = 1024) {
  const fichier = new File(['x'], nom, { type })
  Object.defineProperty(fichier, 'size', { value: taille })
  return fichier
}

describe('validerFichierDocument', () => {
  it('accepte un PDF ou une image raisonnable', () => {
    expect(validerFichierDocument(fichierDe('passeport.pdf', 'application/pdf'))).toBeNull()
    expect(validerFichierDocument(fichierDe('photo.jpg', 'image/jpeg'))).toBeNull()
  })

  it('refuse un type non autorisé', () => {
    expect(validerFichierDocument(fichierDe('page.html', 'text/html'))).toMatch(/PDF, JPEG, PNG ou WebP/)
    expect(validerFichierDocument(fichierDe('image.svg', 'image/svg+xml'))).toMatch(/PDF, JPEG, PNG ou WebP/)
  })

  it('refuse un fichier de plus de 10 Mo', () => {
    expect(validerFichierDocument(fichierDe('gros.pdf', 'application/pdf', 10 * 1024 * 1024 + 1))).toMatch(/10 Mo/)
  })
})

describe('cheminFichierDocument', () => {
  it('range le fichier sous l’agence et n’utilise pas le nom d’origine', () => {
    const chemin = cheminFichierDocument('agence-1', 'pelerin-1', fichierDe('../../autre agence/x.pdf', 'application/pdf'))
    expect(chemin).toMatch(/^agence-1\/pelerin-1\/[0-9a-f-]{36}\.pdf$/)
  })
})

describe('expirantDans', () => {
  const reference = new Date('2026-08-14T10:00:00')

  it('vrai si l’expiration tombe dans la fenêtre', () => {
    expect(expirantDans('2026-10-01', 90, reference)).toBe(true)
  })

  it('vrai si l’expiration tombe exactement sur la borne de la fenêtre (inclusif)', () => {
    const reference = new Date('2026-08-14T10:00:00')
    expect(expirantDans('2026-11-12', 90, reference)).toBe(true)
  })

  it('faux si l’expiration dépasse la fenêtre', () => {
    expect(expirantDans('2027-01-01', 90, reference)).toBe(false)
  })

  it('faux si le document est déjà expiré', () => {
    expect(expirantDans('2026-07-01', 90, reference)).toBe(false)
  })

  it('faux pour une date invalide', () => {
    expect(expirantDans('pas-une-date', 90, reference)).toBe(false)
  })
})

describe('validerSansFichier', () => {
  const upsert = vi.fn()

  beforeEach(() => {
    upsert.mockReset()
    upsert.mockResolvedValue({ error: null })
    mockSupabase.from.mockReset()
    mockSupabase.from.mockReturnValue({ upsert })
  })

  it('crée la ligne au statut valide sans fichier_url', async () => {
    await validerSansFichier('ag1', 'pel1', 'passeport')
    expect(mockSupabase.from).toHaveBeenCalledWith('documents')
    const [ligne, options] = upsert.mock.calls[0]
    expect(ligne).toMatchObject({
      agence_id: 'ag1',
      pelerin_id: 'pel1',
      type_document: 'passeport',
      statut: 'valide',
    })
    expect(ligne.fichier_url).toBeUndefined()
    expect(options).toEqual({ onConflict: 'pelerin_id,type_document' })
  })

  it('propage une erreur Supabase', async () => {
    upsert.mockResolvedValue({ error: new Error('boom') })
    await expect(validerSansFichier('ag1', 'pel1', 'visa')).rejects.toThrow('boom')
  })

  it('inclut date_expiration et numero_document quand fournis', async () => {
    await validerSansFichier('ag1', 'pel1', 'passeport', {
      date_expiration: '2027-06-15',
      numero_document: 'AB123',
    })
    const [ligne] = upsert.mock.calls[0]
    expect(ligne).toMatchObject({
      date_expiration: '2027-06-15',
      numero_document: 'AB123',
    })
    expect(ligne.fichier_url).toBeUndefined()
  })

  it('ne modifie pas le payload sans métadonnées', async () => {
    await validerSansFichier('ag1', 'pel1', 'visa')
    const [ligne] = upsert.mock.calls[0]
    expect(ligne.date_expiration).toBeUndefined()
    expect(ligne.numero_document).toBeUndefined()
  })
})

describe('majMetadonnees', () => {
  const update = vi.fn()
  const eq = vi.fn()

  beforeEach(() => {
    update.mockReset()
    eq.mockReset()
    update.mockReturnValue({ eq })
    eq.mockResolvedValue({ error: null })
    mockSupabase.from.mockReset()
    mockSupabase.from.mockReturnValue({ update })
  })

  it('met à jour les métadonnées du document', async () => {
    await majMetadonnees('doc1', { date_expiration: '2027-06-15', numero_document: null })
    expect(mockSupabase.from).toHaveBeenCalledWith('documents')
    expect(update).toHaveBeenCalledWith({ date_expiration: '2027-06-15', numero_document: null })
    expect(eq).toHaveBeenCalledWith('id', 'doc1')
  })

  it('propage une erreur Supabase', async () => {
    eq.mockResolvedValue({ error: new Error('boom') })
    await expect(
      majMetadonnees('doc1', { date_expiration: null, numero_document: null })
    ).rejects.toThrow('boom')
  })
})