import { describe, expect, it } from 'vitest'
import { buildShortUrl } from './build-short-url'

describe('buildShortUrl', () => {
  it('monta a URL a partir de VITE_FRONTEND_URL', () => {
    expect(buildShortUrl('meu-link')).toBe('http://localhost:5173/meu-link')
  })

  it('não duplica a barra quando a base termina com /', () => {
    expect(buildShortUrl('x', 'http://localhost:5173/')).toBe(
      'http://localhost:5173/x'
    )
  })
})
