import { eq } from 'drizzle-orm'
import postgres from 'postgres'
import { z } from 'zod'
import { SlugAlreadyExists } from '@/app/errors/slug-already-exists'
import { SlugIsReserved } from '@/app/errors/slug-is-reserved'
import { db } from '@/infra/db'
import { schema } from '@/infra/db/schemas'
import { type Either, makeLeft, makeRight } from '@/infra/shared/either'
import { isReservedSlug } from '@/infra/shared/reserved-slugs'
import { originalUrlSchema, slugSchema } from '@/infra/shared/schemas'

const createLinkInput = z.object({
  originalUrl: originalUrlSchema,
  slug: slugSchema,
})

export type CreateLinkInput = z.input<typeof createLinkInput>

export type LinkOutput = {
  originalUrl: string
  slug: string
  accessCount: number
  createdAt: Date
}

// SQLSTATE para "unique_violation". `links` só tem uma UNIQUE constraint
// (slug), então esse código nesse INSERT é inequívoco.
const UNIQUE_VIOLATION = '23505'

// O driver postgres-js lança PostgresError, mas o Drizzle o embrulha em um
// DrizzleQueryError e move o original para `.cause`. Checamos os dois
// formatos para não depender de detalhe de implementação de uma versão.
function isUniqueViolation(error: unknown): boolean {
  const cause =
    error instanceof Error && error.cause instanceof Error ? error.cause : error

  return (
    cause instanceof postgres.PostgresError && cause.code === UNIQUE_VIOLATION
  )
}

export async function createLink(
  input: CreateLinkInput
): Promise<Either<Error, LinkOutput>> {
  const { originalUrl, slug } = createLinkInput.parse(input)

  if (isReservedSlug(slug)) {
    return makeLeft(new SlugIsReserved())
  }

  const existing = await db
    .select({ id: schema.links.id })
    .from(schema.links)
    .where(eq(schema.links.slug, slug))
    .limit(1)

  if (existing.length > 0) {
    return makeLeft(new SlugAlreadyExists())
  }

  try {
    const [created] = await db
      .insert(schema.links)
      .values({ originalUrl, slug })
      .returning({
        originalUrl: schema.links.originalUrl,
        slug: schema.links.slug,
        accessCount: schema.links.accessCount,
        createdAt: schema.links.createdAt,
      })

    if (!created) {
      throw new Error('Falha ao criar o link')
    }

    return makeRight(created)
  } catch (error) {
    // Backstop para a corrida entre o SELECT acima e este INSERT: duas
    // chamadas concorrentes podem passar pelo SELECT vendo zero linhas e
    // colidir aqui na constraint UNIQUE de `slug`. O SELECT continua sendo o
    // caminho comum (Left limpo sem tocar o banco em escrita); isto é só a
    // rede de segurança para o caso raro de a corrida acontecer.
    if (isUniqueViolation(error)) {
      return makeLeft(new SlugAlreadyExists())
    }

    throw error
  }
}
