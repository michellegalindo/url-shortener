import { desc, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/infra/db'
import { schema } from '@/infra/db/schemas'
import { decodeCursor, encodeCursor } from '@/infra/shared/cursor'
import { type Either, makeRight } from '@/infra/shared/either'
import type { LinkOutput } from './create-link'

const listLinksInput = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListLinksInput = z.input<typeof listLinksInput>

export type ListLinksOutput = {
  links: LinkOutput[]
  nextCursor: string | null
}

export async function listLinks(
  input: ListLinksInput
): Promise<Either<Error, ListLinksOutput>> {
  const { cursor, limit } = listLinksInput.parse(input)

  const anchor = cursor ? decodeCursor(cursor) : null

  // comparação de row-value: vira um único Index Cond (start condition), em
  // vez do OR/AND equivalente, que o planner só consegue aplicar como Filter
  // pós-índice — varrendo e descartando toda linha anterior ao anchor
  const condition = anchor
    ? sql`(${schema.links.createdAt}, ${schema.links.id}) < (${anchor.createdAt.toISOString()}, ${anchor.id})`
    : undefined

  // busca uma linha a mais que o limite: a presença dela indica que existe
  // próxima página, sem precisar de um COUNT separado
  const rows = await db
    .select({
      id: schema.links.id,
      originalUrl: schema.links.originalUrl,
      slug: schema.links.slug,
      accessCount: schema.links.accessCount,
      createdAt: schema.links.createdAt,
    })
    .from(schema.links)
    .where(condition)
    .orderBy(desc(schema.links.createdAt), desc(schema.links.id))
    .limit(limit + 1)

  const hasNextPage = rows.length > limit
  const page = hasNextPage ? rows.slice(0, limit) : rows
  const last = page.at(-1)

  return makeRight({
    links: page.map(({ id: _id, ...publicFields }) => publicFields),
    nextCursor:
      hasNextPage && last
        ? encodeCursor({ createdAt: last.createdAt, id: last.id })
        : null,
  })
}
