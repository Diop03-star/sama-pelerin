import { describe, it, expect } from 'vitest'
import { extraireIdYoutube, miniatureYoutube, lienYoutube } from './youtube'

describe('extraireIdYoutube', () => {
  it("extrait l'ID d'une URL watch", () => {
    expect(extraireIdYoutube('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it("extrait l'ID d'une URL youtu.be", () => {
    expect(extraireIdYoutube('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it("extrait l'ID d'une URL shorts", () => {
    expect(extraireIdYoutube('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it("extrait l'ID d'une URL embed", () => {
    expect(extraireIdYoutube('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it('renvoie null pour une URL invalide', () => {
    expect(extraireIdYoutube('https://example.com/video')).toBeNull()
  })
})

describe('miniatureYoutube / lienYoutube', () => {
  it('construit la miniature', () => {
    expect(miniatureYoutube('dQw4w9WgXcQ')).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
  })
  it('construit le lien de lecture', () => {
    expect(lienYoutube('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })
})