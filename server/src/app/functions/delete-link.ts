import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { LinkNotFound } from '@/app/errors/link-not-found'
import { db } from '@/infra/db'
import { schema } from '@/infra/db/schemas'
import { type Either, makeLeft, makeRight } from '@/infra/shared/either'
import { slugSchema } from '@/infra/shared/schemas'

const deleteLinkInput = z.object({ slug: slugSchema })

export type DeleteLinkInput = z.input<typeof deleteLinkInput>

export async function deleteLink(
  input: DeleteLinkInput
): Promise<Either<Error, true>> {
  const { slug } = deleteLinkInput.parse(input)

  const removed = await db
    .delete(schema.links)
    .where(eq(schema.links.slug, slug))
    .returning({ id: schema.links.id })

  if (removed.length === 0) {
    return makeLeft(new LinkNotFound())
  }

  // `true`, e não `undefined`: a implementação do Either discrimina os lados
  // por `!== undefined`, então makeRight(undefined) quebraria isRight (D7)
  return makeRight(true)
}
