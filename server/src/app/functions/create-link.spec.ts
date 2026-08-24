import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { SlugAlreadyExists } from '@/app/errors/slug-already-exists'
import { SlugIsReserved } from '@/app/errors/slug-is-reserved'
import { isLeft, isRight, unwrapEither } from '@/infra/shared/either'
import { createLink } from './create-link'

describe('createLink', () => {
  it('cria um link e devolve os campos públicos', async () => {
    const result = await createLink({
      originalUrl: 'https://example.com/pagina',
      slug: 'meu-link',
    })

    expect(isRight(result)).toBe(true)
    if (isLeft(result)) return

    const link = unwrapEither(result)

    expect(link.originalUrl).toBe('https://example.com/pagina')
    expect(link.slug).toBe('meu-link')
    expect(link.accessCount).toBe(0)
    expect(link.createdAt).toBeInstanceOf(Date)
  })

  it('não expõe o id interno', async () => {
    const result = await createLink({
      originalUrl: 'https://example.com',
      slug: 'sem-id',
    })

    if (isLeft(result)) throw new Error('esperava sucesso')

    expect(unwrapEither(result)).not.toHaveProperty('id')
  })

  it('normaliza o slug para minúsculas', async () => {
    const result = await createLink({
      originalUrl: 'https://example.com',
      slug: 'MeuLink',
    })

    if (isLeft(result)) throw new Error('esperava sucesso')

    expect(unwrapEither(result).slug).toBe('meulink')
  })

  it('rejeita slug já cadastrado', async () => {
    await createLink({ originalUrl: 'https://a.com', slug: 'duplicado' })

    const result = await createLink({
      originalUrl: 'https://b.com',
      slug: 'duplicado',
    })

    expect(isLeft(result)).toBe(true)
    if (isRight(result)) return

    expect(unwrapEither(result)).toBeInstanceOf(SlugAlreadyExists)
  })

  it('detecta duplicidade mesmo com grafia diferente', async () => {
    await createLink({ originalUrl: 'https://a.com', slug: 'unico' })

    const result = await createLink({
      originalUrl: 'https://b.com',
      slug: 'UNICO',
    })

    expect(isLeft(result)).toBe(true)
  })

  it('rejeita slug reservado', async () => {
    const result = await createLink({
      originalUrl: 'https://example.com',
      slug: 'assets',
    })

    expect(isLeft(result)).toBe(true)
    if (isRight(result)) return

    expect(unwrapEither(result)).toBeInstanceOf(SlugIsReserved)
  })

  it('rejeita URL inválida com ZodError', async () => {
    await expect(
      createLink({ originalUrl: 'nao-e-url', slug: 'valido' })
    ).rejects.toBeInstanceOf(z.ZodError)
  })

  it('rejeita slug malformado com ZodError', async () => {
    await expect(
      createLink({ originalUrl: 'https://example.com', slug: 'ab' })
    ).rejects.toBeInstanceOf(z.ZodError)
  })
})
