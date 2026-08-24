import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { LinkNotFound } from '@/app/errors/link-not-found'
import { db } from '@/infra/db'
import { schema } from '@/infra/db/schemas'
import { type Either, makeLeft, makeRight } from '@/infra/shared/either'
import { slugSchema } from '@/infra/shared/schemas'
import type { LinkOutput } from './create-link'

const getLinkBySlugInput = z.object({ slug: slugSchema })

export type GetLinkBySlugInput = z.input<typeof getLinkBySlugInput>

export async function getLinkBySlug(
  input: GetLinkBySlugInput
): Promise<Either<Error, LinkOutput>> {
  const { slug } = getLinkBySlugInput.parse(input)

  const [found] = await db
    .select({
      originalUrl: schema.links.originalUrl,
      slug: schema.links.slug,
      accessCount: schema.links.accessCount,
      createdAt: schema.links.createdAt,
    })
    .from(schema.links)
    .where(eq(schema.links.slug, slug))
    .limit(1)

  if (!found) {
    return makeLeft(new LinkNotFound())
  }

  return makeRight(found)
}
