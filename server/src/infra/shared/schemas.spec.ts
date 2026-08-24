import { describe, expect, it } from 'vitest'
import { originalUrlSchema, slugSchema } from './schemas'

describe('slugSchema', () => {
  it('aceita letras minúsculas, números e hífens', () => {
    expect(slugSchema.parse('meu-link-1')).toBe('meu-link-1')
  })

  it('normaliza maiúsculas para minúsculas', () => {
    expect(slugSchema.parse('MeuLink')).toBe('meulink')
  })

  it('remove espaços nas pontas', () => {
    expect(slugSchema.parse('  meu-link  ')).toBe('meu-link')
  })

  it.each([
    'ab',
    'a'.repeat(33),
    'meu_link',
    'meu link',
    '-meu',
    'meu-',
    'meu--link',
  ])('rejeita %s', invalid => {
    expect(slugSchema.safeParse(invalid).success).toBe(false)
  })
})

describe('originalUrlSchema', () => {
  it('aceita uma URL válida', () => {
    expect(originalUrlSchema.parse('https://example.com/a')).toBe(
      'https://example.com/a'
    )
  })

  it.each(['nao-e-url', 'example.com', ''])('rejeita %s', invalid => {
    expect(originalUrlSchema.safeParse(invalid).success).toBe(false)
  })
})
