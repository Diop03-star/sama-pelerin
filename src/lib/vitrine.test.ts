import { describe, it, expect } from 'vitest'
import { whatsappDemoUrl, MESSAGE_DEMO, NUMERO_WHATSAPP } from './vitrine'

describe('whatsappDemoUrl', () => {
  it('construit le lien wa.me avec le message pré-rempli', () => {
    const url = whatsappDemoUrl()
    expect(url.startsWith(`https://wa.me/${NUMERO_WHATSAPP}?text=`)).toBe(true)
    expect(decodeURIComponent(url)).toContain(MESSAGE_DEMO)
  })
})