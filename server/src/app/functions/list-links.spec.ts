import { describe, expect, it } from 'vitest'
import { db } from '@/infra/db'
import { schema } from '@/infra/db/schemas'
import { isLeft, unwrapEither } from '@/infra/shared/either'
import { listLinks } from './list-links'

async function seed(
  count: number,
  baseTime = Date.parse('2026-08-24T12:00:00Z')
) {
  const rows = Array.from({ length: count }, (_, i) => ({
    originalUrl: `https://example.com/${i}`,
    slug: `slug-${String(i).padStart(3, '0')}`,
    createdAt: new Date(baseTime + i * 1000),
  }))

  await db.insert(schema.links).values(rows)
}

function unwrap<T>(result: Awaited<ReturnType<typeof listLinks>>) {
  if (isLeft(result)) throw new Error('esperava sucesso')
  return unwrapEither(result)
}

describe('listLinks', () => {
  it('devolve lista vazia e nextCursor null quando não há links', async () => {
    const page = unwrap(await listLinks({}))

    expect(page.links).toHaveLength(0)
    expect(page.nextCursor).toBeNull()
  })

  it('ordena do mais recente para o mais antigo', async () => {
    await seed(3)

    const page = unwrap(await listLinks({}))

    expect(page.links.map(l => l.slug)).toEqual([
      'slug-002',
      'slug-001',
      'slug-000',
    ])
  })

  it('respeita o limit e devolve nextCursor quando há mais', async () => {
    await seed(5)

    const page = unwrap(await listLinks({ limit: 2 }))

    expect(page.links).toHaveLength(2)
    expect(page.nextCursor).not.toBeNull()
  })

  it('devolve nextCursor null na última página', async () => {
    await seed(2)

    const page = unwrap(await listLinks({ limit: 5 }))

    expect(page.links).toHaveLength(2)
    expect(page.nextCursor).toBeNull()
  })

  it('pagina sem repetir nem pular itens', async () => {
    await seed(5)

    const first = unwrap(await listLinks({ limit: 2 }))
    const second = unwrap(
      await listLinks({ limit: 2, cursor: first.nextCursor ?? undefined })
    )
    const third = unwrap(
      await listLinks({ limit: 2, cursor: second.nextCursor ?? undefined })
    )

    const slugs = [...first.links, ...second.links, ...third.links].map(
      l => l.slug
    )

    expect(slugs).toEqual([
      'slug-004',
      'slug-003',
      'slug-002',
      'slug-001',
      'slug-000',
    ])
    expect(new Set(slugs).size).toBe(5)
  })

  it('não duplica nem esconde item quando um link é criado entre páginas', async () => {
    await seed(4)

    const first = unwrap(await listLinks({ limit: 2 }))

    // um link novo entra no topo da ordenação, deslocando as linhas
    await db.insert(schema.links).values({
      originalUrl: 'https://example.com/novo',
      slug: 'slug-novo',
      createdAt: new Date(Date.parse('2026-08-24T13:00:00Z')),
    })

    const second = unwrap(
      await listLinks({ limit: 2, cursor: first.nextCursor ?? undefined })
    )

    const slugs = [...first.links, ...second.links].map(l => l.slug)

    expect(new Set(slugs).size).toBe(slugs.length)
    expect(second.links.map(l => l.slug)).toEqual(['slug-001', 'slug-000'])
  })

  it('desempata por id quando createdAt é idêntico', async () => {
    const sameMoment = new Date('2026-08-24T12:00:00Z')

    await db.insert(schema.links).values([
      { originalUrl: 'https://a.com', slug: 'empate-a', createdAt: sameMoment },
      { originalUrl: 'https://b.com', slug: 'empate-b', createdAt: sameMoment },
      { originalUrl: 'https://c.com', slug: 'empate-c', createdAt: sameMoment },
    ])

    const first = unwrap(await listLinks({ limit: 2 }))
    const second = unwrap(
      await listLinks({ limit: 2, cursor: first.nextCursor ?? undefined })
    )

    const slugs = [...first.links, ...second.links].map(l => l.slug)

    expect(new Set(slugs).size).toBe(3)
  })

  it('trata cursor inválido como primeira página', async () => {
    await seed(3)

    const page = unwrap(await listLinks({ cursor: 'lixo!!!' }))

    expect(page.links).toHaveLength(3)
  })
})
