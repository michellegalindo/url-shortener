import { describe, expect, it } from 'vitest'
import { LinkNotFound } from '@/app/errors/link-not-found'
import { isLeft, isRight, unwrapEither } from '@/infra/shared/either'
import { createLink } from './create-link'
import { incrementLinkVisits } from './increment-link-visits'

describe('incrementLinkVisits', () => {
  it('incrementa de 0 para 1 e devolve o novo total', async () => {
    await createLink({ originalUrl: 'https://example.com', slug: 'contador' })

    const result = await incrementLinkVisits({ slug: 'contador' })

    expect(isRight(result)).toBe(true)
    if (isLeft(result)) return

    expect(unwrapEither(result).accessCount).toBe(1)
  })

  it('acumula em chamadas sucessivas', async () => {
    await createLink({ originalUrl: 'https://example.com', slug: 'acumula' })

    await incrementLinkVisits({ slug: 'acumula' })
    await incrementLinkVisits({ slug: 'acumula' })
    const result = await incrementLinkVisits({ slug: 'acumula' })

    if (isLeft(result)) throw new Error('esperava sucesso')

    expect(unwrapEither(result).accessCount).toBe(3)
  })

  it('não perde contagens sob chamadas concorrentes', async () => {
    await createLink({ originalUrl: 'https://example.com', slug: 'corrida' })

    await Promise.all(
      Array.from({ length: 20 }, () => incrementLinkVisits({ slug: 'corrida' }))
    )

    const result = await incrementLinkVisits({ slug: 'corrida' })

    if (isLeft(result)) throw new Error('esperava sucesso')

    expect(unwrapEither(result).accessCount).toBe(21)
  })

  it('não afeta o contador de outros links', async () => {
    await createLink({ originalUrl: 'https://a.com', slug: 'alvo' })
    await createLink({ originalUrl: 'https://b.com', slug: 'intacto' })

    await incrementLinkVisits({ slug: 'alvo' })
    const result = await incrementLinkVisits({ slug: 'intacto' })

    if (isLeft(result)) throw new Error('esperava sucesso')

    expect(unwrapEither(result).accessCount).toBe(1)
  })

  it('devolve LinkNotFound quando o slug não existe', async () => {
    const result = await incrementLinkVisits({ slug: 'inexistente' })

    expect(isLeft(result)).toBe(true)
    if (isRight(result)) return

    expect(unwrapEither(result)).toBeInstanceOf(LinkNotFound)
  })
})
