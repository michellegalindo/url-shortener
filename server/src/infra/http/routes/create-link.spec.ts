import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('POST /links', () => {
  it('cria o link e responde 201', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/links',
      payload: { originalUrl: 'https://example.com/a', slug: 'novo-link' },
    })

    expect(response.statusCode).toBe(201)

    const body = response.json()

    expect(body.slug).toBe('novo-link')
    expect(body.accessCount).toBe(0)
    expect(typeof body.createdAt).toBe('string')
    expect(body).not.toHaveProperty('id')
  })

  it('responde 409 para slug duplicado', async () => {
    await app.inject({
      method: 'POST',
      url: '/links',
      payload: { originalUrl: 'https://a.com', slug: 'repetido' },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/links',
      payload: { originalUrl: 'https://b.com', slug: 'repetido' },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json().message).toBeTruthy()
  })

  it('responde 409 para slug reservado', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/links',
      payload: { originalUrl: 'https://a.com', slug: 'assets' },
    })

    expect(response.statusCode).toBe(409)
  })

  it('responde 400 com issues para URL inválida', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/links',
      payload: { originalUrl: 'nao-e-url', slug: 'valido' },
    })

    expect(response.statusCode).toBe(400)

    const body = response.json()

    expect(body.message).toBeTruthy()
    expect(Array.isArray(body.issues)).toBe(true)
    expect(body.issues[0]).toHaveProperty('path')
    expect(body.issues[0]).toHaveProperty('message')
  })

  it('responde 400 quando dois campos são inválidos, listando os dois', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/links',
      payload: { originalUrl: 'nao-e-url', slug: 'ab' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().issues.length).toBeGreaterThanOrEqual(2)
  })

  it('responde 400, não 500, para JSON malformado', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/links',
      headers: { 'content-type': 'application/json' },
      payload: '{"originalUrl":',
    })

    expect(response.statusCode).toBe(400)
  })

  it('responde 400 quando o corpo falha na validação do type provider (não no use-case)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/links',
      payload: { originalUrl: 123, slug: 'valido' },
    })

    expect(response.statusCode).toBe(400)
    expect(Array.isArray(response.json().issues)).toBe(true)
  })
})
