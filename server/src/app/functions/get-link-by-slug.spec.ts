import { describe, expect, it } from 'vitest'
import { LinkNotFound } from '@/app/errors/link-not-found'
import { isLeft, isRight, unwrapEither } from '@/infra/shared/either'
import { createLink } from './create-link'
import { getLinkBySlug } from './get-link-by-slug'

describe('getLinkBySlug', () => {
  it('devolve o link existente', async () => {
    await createLink({ originalUrl: 'https://example.com/x', slug: 'busca' })

    const result = await getLinkBySlug({ slug: 'busca' })

    expect(isRight(result)).toBe(true)
    if (isLeft(result)) return

    expect(unwrapEither(result).originalUrl).toBe('https://example.com/x')
  })

  it('não incrementa o contador de acessos', async () => {
    await createLink({ originalUrl: 'https://example.com', slug: 'sem-conta' })

    await getLinkBySlug({ slug: 'sem-conta' })
    const result = await getLinkBySlug({ slug: 'sem-conta' })

    if (isLeft(result)) throw new Error('esperava sucesso')

    expect(unwrapEither(result).accessCount).toBe(0)
  })

  it('encontra o link mesmo com grafia diferente', async () => {
    await createLink({ originalUrl: 'https://example.com', slug: 'caixa' })

    expect(isRight(await getLinkBySlug({ slug: 'CAIXA' }))).toBe(true)
  })

  it('devolve LinkNotFound quando o slug não existe', async () => {
    const result = await getLinkBySlug({ slug: 'inexistente' })

    expect(isLeft(result)).toBe(true)
    if (isRight(result)) return

    expect(unwrapEither(result)).toBeInstanceOf(LinkNotFound)
  })

  it('devolve LinkNotFound (não ZodError) para slug malformado', async () => {
    const result = await getLinkBySlug({ slug: 'ab' })

    expect(isLeft(result)).toBe(true)
    if (isRight(result)) return

    expect(unwrapEither(result)).toBeInstanceOf(LinkNotFound)
  })
})
