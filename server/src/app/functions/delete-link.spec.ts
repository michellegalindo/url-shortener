import { describe, expect, it } from 'vitest'
import { LinkNotFound } from '@/app/errors/link-not-found'
import { isLeft, isRight, unwrapEither } from '@/infra/shared/either'
import { createLink } from './create-link'
import { deleteLink } from './delete-link'
import { getLinkBySlug } from './get-link-by-slug'

describe('deleteLink', () => {
  it('remove um link existente e devolve true', async () => {
    await createLink({ originalUrl: 'https://example.com', slug: 'remover' })

    const result = await deleteLink({ slug: 'remover' })

    expect(isRight(result)).toBe(true)
    if (isLeft(result)) return

    expect(unwrapEither(result)).toBe(true)
    expect(isLeft(await getLinkBySlug({ slug: 'remover' }))).toBe(true)
  })

  it('não afeta os demais links', async () => {
    await createLink({ originalUrl: 'https://a.com', slug: 'sai' })
    await createLink({ originalUrl: 'https://b.com', slug: 'fica' })

    await deleteLink({ slug: 'sai' })

    expect(isRight(await getLinkBySlug({ slug: 'fica' }))).toBe(true)
  })

  it('devolve LinkNotFound quando o slug não existe', async () => {
    const result = await deleteLink({ slug: 'inexistente' })

    expect(isLeft(result)).toBe(true)
    if (isRight(result)) return

    expect(unwrapEither(result)).toBeInstanceOf(LinkNotFound)
  })

  it('devolve LinkNotFound ao remover o mesmo link duas vezes', async () => {
    await createLink({ originalUrl: 'https://example.com', slug: 'duas-vezes' })

    expect(isRight(await deleteLink({ slug: 'duas-vezes' }))).toBe(true)
    expect(isLeft(await deleteLink({ slug: 'duas-vezes' }))).toBe(true)
  })
})
