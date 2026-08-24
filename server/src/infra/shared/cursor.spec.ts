import { describe, expect, it } from 'vitest'
import { decodeCursor, encodeCursor } from './cursor'

describe('cursor', () => {
  const anchor = {
    createdAt: new Date('2026-08-24T12:00:00.000Z'),
    id: '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  }

  it('faz round-trip preservando os valores', () => {
    const decoded = decodeCursor(encodeCursor(anchor))

    expect(decoded).not.toBeNull()
    expect(decoded?.id).toBe(anchor.id)
    expect(decoded?.createdAt.toISOString()).toBe(
      anchor.createdAt.toISOString()
    )
  })

  it('produz uma string opaca, sem os valores legíveis', () => {
    expect(encodeCursor(anchor)).not.toContain(anchor.id)
  })

  it('devolve null para cursor malformado', () => {
    expect(decodeCursor('nao-e-base64!!!')).toBeNull()
    expect(decodeCursor('')).toBeNull()
  })

  it('devolve null para base64 válido sem os campos esperados', () => {
    const bogus = Buffer.from(JSON.stringify({ foo: 'bar' })).toString(
      'base64url'
    )

    expect(decodeCursor(bogus)).toBeNull()
  })
})
