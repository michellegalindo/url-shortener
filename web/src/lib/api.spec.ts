import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from './api'

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response)
}

afterEach(() => vi.unstubAllGlobals())

describe('api', () => {
  it('devolve o corpo em caso de sucesso', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { slug: 'x' }))

    await expect(api<{ slug: string }>('/links')).resolves.toEqual({
      slug: 'x',
    })
  })

  it('devolve undefined em 204, sem tentar ler o corpo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: async () => {
          throw new Error('não deveria ler o corpo de um 204')
        },
      } as unknown as Response)
    )

    await expect(api('/links/x', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('lança ApiError preservando o status', async () => {
    vi.stubGlobal('fetch', mockFetch(404, { message: 'Link não encontrado.' }))

    const error = await api<never>('/links/x').catch((e: ApiError) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(404)
    expect(error.message).toBe('Link não encontrado.')
  })

  it('preserva issues no erro 400', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(400, {
        message: 'Dados inválidos.',
        issues: [{ path: 'slug', message: 'muito curto' }],
      })
    )

    const error = await api<never>('/links', { method: 'POST' }).catch(
      (e: ApiError) => e
    )

    expect(error.issues).toEqual([{ path: 'slug', message: 'muito curto' }])
  })

  it('vira ApiError com status 0 quando a rede falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')))

    const error = await api<never>('/links').catch((e: ApiError) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
  })

  it('não envia content-type quando a requisição não tem corpo', async () => {
    const fetch = mockFetch(204, null)
    vi.stubGlobal('fetch', fetch)

    await api('/links/x', { method: 'DELETE' })

    const init = fetch.mock.calls[0]?.[1] as RequestInit
    expect(
      (init.headers as Record<string, string>)['content-type']
    ).toBeUndefined()
  })

  it('envia content-type quando a requisição tem corpo', async () => {
    const fetch = mockFetch(200, { ok: true })
    vi.stubGlobal('fetch', fetch)

    await api('/links', { method: 'POST', body: JSON.stringify({}) })

    const init = fetch.mock.calls[0]?.[1] as RequestInit
    expect((init.headers as Record<string, string>)['content-type']).toBe(
      'application/json'
    )
  })
})
