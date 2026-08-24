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

async function create(slug: string, originalUrl = 'https://example.com/a') {
  return app.inject({
    method: 'POST',
    url: '/links',
    payload: { originalUrl, slug },
  })
}

describe('GET /links', () => {
  it('devolve lista vazia com nextCursor null', async () => {
    const response = await app.inject({ method: 'GET', url: '/links' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ links: [], nextCursor: null })
  })

  it('pagina com cursor', async () => {
    await create('uno')
    await create('dois')
    await create('tres')

    const first = await app.inject({ method: 'GET', url: '/links?limit=2' })

    expect(first.json().links).toHaveLength(2)

    const cursor = first.json().nextCursor

    expect(cursor).not.toBeNull()

    const second = await app.inject({
      method: 'GET',
      url: `/links?limit=2&cursor=${encodeURIComponent(cursor)}`,
    })

    expect(second.json().links).toHaveLength(1)
    expect(second.json().nextCursor).toBeNull()
  })
})

describe('GET /links/:slug', () => {
  it('resolve o slug e responde 200', async () => {
    await create('resolver', 'https://example.com/destino')

    const response = await app.inject({
      method: 'GET',
      url: '/links/resolver',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().originalUrl).toBe('https://example.com/destino')
  })

  it('responde 404 para slug inexistente', async () => {
    const response = await app.inject({ method: 'GET', url: '/links/nada' })

    expect(response.statusCode).toBe(404)
  })
})

describe('PATCH /links/:slug/visits', () => {
  it('responde 204 e incrementa o contador', async () => {
    await create('visitas')

    const response = await app.inject({
      method: 'PATCH',
      url: '/links/visitas/visits',
    })

    expect(response.statusCode).toBe(204)
    expect(response.body).toBe('')

    const link = await app.inject({ method: 'GET', url: '/links/visitas' })

    expect(link.json().accessCount).toBe(1)
  })

  it('responde 404 para slug inexistente', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/links/nada/visits',
    })

    expect(response.statusCode).toBe(404)
  })
})

describe('DELETE /links/:slug', () => {
  it('responde 204 e remove o link', async () => {
    await create('apagar')

    const response = await app.inject({
      method: 'DELETE',
      url: '/links/apagar',
    })

    expect(response.statusCode).toBe(204)

    const link = await app.inject({ method: 'GET', url: '/links/apagar' })

    expect(link.statusCode).toBe(404)
  })

  it('responde 404 para slug inexistente', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/links/nada' })

    expect(response.statusCode).toBe(404)
  })
})

describe('POST /links/exports', () => {
  it('responde 422 quando não há links', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/links/exports',
    })

    expect(response.statusCode).toBe(422)
  })
})
