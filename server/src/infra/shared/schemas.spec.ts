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

  it('aceita http://', () => {
    expect(originalUrlSchema.parse('http://example.com/a')).toBe(
      'http://example.com/a'
    )
  })

  it.each([
    'nao-e-url',
    'example.com',
    '',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
  ])('rejeita %s', invalid => {
    expect(originalUrlSchema.safeParse(invalid).success).toBe(false)
  })

  it('aceita URL com exatamente 2048 caracteres', () => {
    const url = `https://example.com/${'a'.repeat(2048 - 20)}`
    expect(url).toHaveLength(2048)
    expect(originalUrlSchema.safeParse(url).success).toBe(true)
  })

  it('rejeita URL com mais de 2048 caracteres', () => {
    const url = `https://example.com/${'a'.repeat(2048 - 19)}`
    expect(url).toHaveLength(2049)
    expect(originalUrlSchema.safeParse(url).success).toBe(false)
  })
})
