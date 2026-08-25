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
  // safeParse, e não parse: ao contrário de delete/increment, este slug vem
  // direto da URL digitada por um visitante, não de um link já listado pela
  // aplicação — um formato inválido nunca pode existir, então é 404, não 400
  // (o front discrimina a tela de erro por status === 404)
  const parsed = getLinkBySlugInput.safeParse(input)

  if (!parsed.success) {
    return makeLeft(new LinkNotFound())
  }

  const { slug } = parsed.data

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
