import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'

const valid = {
  PORT: '3333',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  FRONTEND_URL: 'http://localhost:5173',
  CLOUDFLARE_ACCOUNT_ID: 'account',
  CLOUDFLARE_ACCESS_KEY_ID: 'key',
  CLOUDFLARE_SECRET_ACCESS_KEY: 'secret',
  CLOUDFLARE_BUCKET: 'bucket',
  CLOUDFLARE_PUBLIC_URL: 'https://cdn.example.com',
}

describe('parseEnv', () => {
  it('converte PORT para número', () => {
    expect(parseEnv(valid).PORT).toBe(3333)
  })

  it('usa 3333 como PORT padrão', () => {
    const { PORT, ...withoutPort } = valid
    expect(parseEnv(withoutPort).PORT).toBe(3333)
  })

  it('lança quando DATABASE_URL falta', () => {
    const { DATABASE_URL, ...incomplete } = valid
    expect(() => parseEnv(incomplete)).toThrow(/DATABASE_URL/)
  })

  it('lança quando FRONTEND_URL falta', () => {
    const { FRONTEND_URL, ...incomplete } = valid
    expect(() => parseEnv(incomplete)).toThrow(/FRONTEND_URL/)
  })

  it('rejeita DATABASE_URL com esquema postgres:// em vez de postgresql://', () => {
    expect(() =>
      parseEnv({
        ...valid,
        DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      })
    ).toThrow(/DATABASE_URL/)
  })

  it('lança quando uma chave da Cloudflare está vazia', () => {
    expect(() => parseEnv({ ...valid, CLOUDFLARE_BUCKET: '' })).toThrow(
      /CLOUDFLARE_BUCKET/
    )
  })
})
