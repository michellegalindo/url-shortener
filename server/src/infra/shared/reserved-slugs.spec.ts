import { describe, expect, it } from 'vitest'
import { isReservedSlug, RESERVED_SLUGS } from './reserved-slugs'

describe('slugs reservados', () => {
  it('reserva o diretório de build do Vite', () => {
    expect(RESERVED_SLUGS).toContain('assets')
  })

  it('identifica um slug reservado', () => {
    expect(isReservedSlug('assets')).toBe(true)
  })

  it('compara ignorando maiúsculas e espaços', () => {
    expect(isReservedSlug('  ASSETS  ')).toBe(true)
  })

  it('libera um slug comum', () => {
    expect(isReservedSlug('meu-link')).toBe(false)
  })

  it('não reserva rotas da API — elas ficam em outra origem', () => {
    expect(isReservedSlug('api')).toBe(false)
    expect(isReservedSlug('docs')).toBe(false)
  })

  it('não reserva not-found — a tela é renderizada dentro de /:slug', () => {
    expect(isReservedSlug('not-found')).toBe(false)
  })
})
