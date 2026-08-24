import { describe, expect, it } from 'vitest'
import { db } from '@/infra/db'
import { schema } from '@/infra/db/schemas'
import { makeLink } from './factories/make-link'

describe('isolamento do banco de teste', () => {
  it('começa com a tabela vazia e insere uma linha', async () => {
    expect(await db.select().from(schema.links)).toHaveLength(0)

    await db.insert(schema.links).values(makeLink())

    expect(await db.select().from(schema.links)).toHaveLength(1)
  })

  it('começa vazia de novo, apesar da inserção do teste anterior', async () => {
    expect(await db.select().from(schema.links)).toHaveLength(0)
  })
})
