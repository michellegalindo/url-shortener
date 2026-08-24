import { eq } from 'drizzle-orm'
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
}
