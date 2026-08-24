import { db, pg } from '@/infra/db'
import { schema } from '@/infra/db/schemas'

const TOTAL = 20_000
const BATCH_SIZE = 5_000

async function seed() {
  console.log(`Criando ${TOTAL.toLocaleString('pt-BR')} links de teste...`)

  const startedAt = Date.now()

  await db.delete(schema.links)

  for (let offset = 0; offset < TOTAL; offset += BATCH_SIZE) {
    const size = Math.min(BATCH_SIZE, TOTAL - offset)

    const batch = Array.from({ length: size }, (_, i) => {
      const index = offset + i

      return {
        originalUrl: `https://example.com/pagina/${index}`,
        slug: `teste-${index}`,
        accessCount: index % 100,
        // createdAt escalonado: sem isso todas as linhas teriam o mesmo
        // instante e a paginação keyset dependeria só do desempate por id
        createdAt: new Date(Date.now() - index * 1000),
      }
    })

    await db.insert(schema.links).values(batch)

    console.log(`  ${offset + size}/${TOTAL}`)
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2)

  console.log(`Concluído em ${elapsed}s`)

  await pg.end()
}

seed().catch(error => {
  console.error('Falha no seed:', error)
  process.exit(1)
})
