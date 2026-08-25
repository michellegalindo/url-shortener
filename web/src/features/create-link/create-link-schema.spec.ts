import { describe, expect, it } from 'vitest'
import { createLinkSchema } from './create-link-schema'

const valid = { originalUrl: 'https://example.com', slug: 'meu-link' }

describe('createLinkSchema', () => {
  it('aceita entrada válida', () => {
    expect(createLinkSchema.safeParse(valid).success).toBe(true)
  })

  it('normaliza o apelido para minúsculas', () => {
    const parsed = createLinkSchema.parse({ ...valid, slug: 'MeuLink' })

    expect(parsed.slug).toBe('meulink')
  })

  it.each(['ab', 'a'.repeat(33), 'meu_link', 'meu link', '-x-', 'a--b'])(
    'rejeita o apelido %s',
    slug => {
      expect(createLinkSchema.safeParse({ ...valid, slug }).success).toBe(false)
    }
  )

  // 'javascript:alert(1)' cobre a mesma restrição de protocolo do servidor
  // (server/src/infra/shared/schemas.ts originalUrlSchema): sem ela, o
  // cliente aceitaria uma URL que a API sempre rejeita com 400.
  it.each(['nao-e-url', 'example.com', '', 'javascript:alert(1)'])(
    'rejeita a URL %s',
    originalUrl => {
      expect(
        createLinkSchema.safeParse({ ...valid, originalUrl }).success
      ).toBe(false)
    }
  )
})
