import { randomUUID } from 'node:crypto'
import { PassThrough, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { stringify } from 'csv-stringify'
import { desc } from 'drizzle-orm'
import { NoLinksToExport } from '@/app/errors/no-links-to-export'
import { env } from '@/env'
import { db, pg } from '@/infra/db'
import { schema } from '@/infra/db/schemas'
import { type Either, makeLeft, makeRight } from '@/infra/shared/either'
import type { Uploader } from '@/infra/storage/uploader'

export type ExportLinksInput = { uploader: Uploader }

export type ExportLinksOutput = { reportUrl: string }

/**
 * Linha como o cursor a entrega: nomes de coluna do banco (snake_case).
 * `pg.unsafe` passa por baixo do mapeamento do Drizzle, então os campos NÃO
 * chegam em camelCase.
 */
type RawRow = {
  original_url: string
  slug: string
  access_count: number
  created_at: string
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

// nome de arquivo: YYYY-MM-DD-HHmmss no fuso local — ordena por hora numa
// listagem e não contém caracteres que precisem de escape no header
function fileTimestamp(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''

  return `${get('year')}-${get('month')}-${get('day')}-${get('hour')}${get('minute')}${get('second')}`
}

export async function exportLinks({
  uploader,
}: ExportLinksInput): Promise<Either<Error, ExportLinksOutput>> {
  const [anyLink] = await db
    .select({ id: schema.links.id })
    .from(schema.links)
    .limit(1)

  if (!anyLink) {
    return makeLeft(new NoLinksToExport())
  }

  const { sql, params } = db
    .select({
      originalUrl: schema.links.originalUrl,
      slug: schema.links.slug,
      accessCount: schema.links.accessCount,
      createdAt: schema.links.createdAt,
    })
    .from(schema.links)
    .orderBy(desc(schema.links.createdAt), desc(schema.links.id))
    .toSQL()

  // cursor real do Postgres: memória constante, snapshot consistente.
  // Lotes por LIMIT/OFFSET seriam O(n²) e permitiriam linhas duplicadas.
  const cursor = pg.unsafe(sql, params as string[]).cursor(50)

  const toCsvRow = new Transform({
    objectMode: true,
    transform(batch: RawRow[], _encoding, callback) {
      for (const row of batch) {
        this.push({
          originalUrl: row.original_url,
          shortUrl: `${env.FRONTEND_URL}/${row.slug}`,
          accessCount: row.access_count,
          createdAt: dateFormatter.format(new Date(row.created_at)),
        })
      }

      callback()
    },
  })

  const csv = stringify({
    header: true,
    columns: [
      { key: 'originalUrl', header: 'URL original' },
      { key: 'shortUrl', header: 'URL encurtada' },
      { key: 'accessCount', header: 'Contagem de acessos' },
      { key: 'createdAt', header: 'Data de criação' },
    ],
  })

  const body = new PassThrough()

  const csvPipeline = pipeline(cursor, toCsvRow, csv, body)

  // o upload precisa começar ANTES de o pipeline bombear: sem consumidor, o
  // PassThrough enche o buffer e o pipeline trava por contrapressão
  // a chave é aleatória e única (requisito); o nome que o navegador salva é
  // o `filename` do Content-Disposition — sem ele, o browser deriva do caminho
  // e o usuário recebe "exports_<uuid>-links.csv". O nome também precisa ser
  // único (várias exportações no mesmo dia): timestamp até o segundo mais o
  // início do mesmo uuid da chave, o que ainda liga o arquivo ao objeto
  const id = randomUUID()
  const filename = `brevly-links-${fileTimestamp(new Date())}-${id.slice(0, 8)}.csv`

  const uploadPromise = uploader.upload({
    key: `exports/${id}-links.csv`,
    contentType: 'text/csv',
    contentDisposition: `attachment; filename="${filename}"`,
    body,
  })

  const [uploaded] = await Promise.all([uploadPromise, csvPipeline])

  return makeRight({ reportUrl: uploaded.url })
}
