import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'

const valid = {
  VITE_FRONTEND_URL: 'http://localhost:5173',
  VITE_BACKEND_URL: 'http://localhost:3333',
}

describe('parseEnv', () => {
  it('aceita as duas chaves obrigatórias', () => {
    const parsed = parseEnv(valid)

    expect(parsed.VITE_BACKEND_URL).toBe('http://localhost:3333')
  })

  it('usa 0 como atraso padrão', () => {
    expect(parseEnv(valid).VITE_API_DELAY_MS).toBe(0)
  })

  it('converte o atraso para número', () => {
    expect(
      parseEnv({ ...valid, VITE_API_DELAY_MS: '500' }).VITE_API_DELAY_MS
    ).toBe(500)
  })

  it('lança quando VITE_BACKEND_URL falta', () => {
    const { VITE_BACKEND_URL, ...incomplete } = valid

    expect(() => parseEnv(incomplete)).toThrow(/VITE_BACKEND_URL/)
  })

  it('lança quando VITE_FRONTEND_URL não é URL', () => {
    expect(() =>
      parseEnv({ ...valid, VITE_FRONTEND_URL: 'nao-e-url' })
    ).toThrow(/VITE_FRONTEND_URL/)
  })
})
