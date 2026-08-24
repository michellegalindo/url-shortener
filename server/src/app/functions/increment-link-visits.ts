import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { LinkNotFound } from '@/app/errors/link-not-found'
import { db } from '@/infra/db'
import { schema } from '@/infra/db/schemas'
import { type Either, makeLeft, makeRight } from '@/infra/shared/either'
import { slugSchema } from '@/infra/shared/schemas'

const incrementLinkVisitsInput = z.object({ slug: slugSchema })

export type IncrementLinkVisitsInput = z.input<typeof incrementLinkVisitsInput>

export type IncrementLinkVisitsOutput = { accessCount: number }

export async function incrementLinkVisits(
  input: IncrementLinkVisitsInput
): Promise<Either<Error, IncrementLinkVisitsOutput>> {
  const { slug } = incrementLinkVisitsInput.parse(input)

  // a soma acontece no banco, numa única instrução: ler-somar-gravar na
  // aplicação perderia contagens sob acessos simultâneos
  const updated = await db
    .update(schema.links)
    .set({ accessCount: sql`${schema.links.accessCount} + 1` })
    .where(eq(schema.links.slug, slug))
    .returning({ accessCount: schema.links.accessCount })

  const row = updated[0]

  if (!row) {
    return makeLeft(new LinkNotFound())
  }

  return makeRight({ accessCount: row.accessCount })
}
