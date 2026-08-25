import { describe, expect, it } from 'vitest'
import { NoLinksToExport } from '@/app/errors/no-links-to-export'
import { db } from '@/infra/db'
import { schema } from '@/infra/db/schemas'
import { isLeft, isRight, unwrapEither } from '@/infra/shared/either'
import { createInMemoryUploader } from '@/test/in-memory-uploader'
import { exportLinks } from './export-links'

describe('exportLinks', () => {
  it('devolve NoLinksToExport quando não há links', async () => {
    const uploader = createInMemoryUploader()

    const result = await exportLinks({ uploader })

    expect(isLeft(result)).toBe(true)
    if (isRight(result)) return

    expect(unwrapEither(result)).toBeInstanceOf(NoLinksToExport)
    expect(uploader.count()).toBe(0)
  })

  it('gera o CSV com o cabeçalho das quatro colunas exigidas', async () => {
    await db.insert(schema.links).values({
      originalUrl: 'https://example.com/a',
      slug: 'link-a',
    })

    const uploader = createInMemoryUploader()
    await exportLinks({ uploader })

    const [header] = uploader.lastBody().split('\n')

    expect(header).toBe(
      'URL original,URL encurtada,Contagem de acessos,Data de criação'
    )
  })

  it('monta a URL encurtada completa, não apenas o slug', async () => {
    await db.insert(schema.links).values({
      originalUrl: 'https://example.com/a',
      slug: 'link-a',
    })

    const uploader = createInMemoryUploader()
    await exportLinks({ uploader })

    const body = uploader.lastBody()

    expect(body).toContain('http://localhost:5173/link-a')
    expect(body).toContain('https://example.com/a')
  })

  it('inclui todas as linhas mesmo em múltiplos lotes do cursor', async () => {
    // o cursor do Postgres busca em lotes de 50: 120 linhas força três
    // lotes, expondo uma regressão que processasse só o primeiro
    await db.insert(schema.links).values(
      Array.from({ length: 120 }, (_, i) => ({
        originalUrl: `https://example.com/${i}`,
        slug: `slug-${i}`,
      }))
    )

    const uploader = createInMemoryUploader()
    await exportLinks({ uploader })

    const rows = uploader.lastBody().trim().split('\n')

    expect(rows).toHaveLength(121) // cabeçalho + 120 linhas
  })

  it('define o Content-Disposition como attachment com nome amigável, datado e único', async () => {
    await db.insert(schema.links).values({
      originalUrl: 'https://example.com/a',
      slug: 'link-attachment',
    })

    const uploader = createInMemoryUploader()
    await exportLinks({ uploader })

    // o nome que o navegador salva vem daqui, não da chave do objeto; o
    // sufixo é o início do uuid da chave, então o arquivo aponta para o objeto
    const disposition = uploader.lastContentDisposition()
    const match = disposition.match(
      /^attachment; filename="brevly-links-\d{4}-\d{2}-\d{2}-\d{6}-([0-9a-f]{8})\.csv"$/
    )

    expect(match).not.toBeNull()
    expect(uploader.lastKey()).toMatch(
      new RegExp(`^exports/${match?.[1]}[0-9a-f-]+-links\\.csv$`)
    )
  })

  it('gera nomes de arquivo diferentes em exportações consecutivas', async () => {
    await db.insert(schema.links).values({
      originalUrl: 'https://example.com/a',
      slug: 'link-unico',
    })

    const uploader = createInMemoryUploader()
    await exportLinks({ uploader })
    const first = uploader.lastContentDisposition()
    await exportLinks({ uploader })

    expect(uploader.lastContentDisposition()).not.toBe(first)
  })

  it('exporta a contagem de acessos', async () => {
    await db.insert(schema.links).values({
      originalUrl: 'https://example.com',
      slug: 'com-acessos',
      accessCount: 42,
    })

    const uploader = createInMemoryUploader()
    await exportLinks({ uploader })

    expect(uploader.lastBody()).toContain('42')
  })

  it('usa o prefixo exports/ e um nome único a cada chamada', async () => {
    await db.insert(schema.links).values({
      originalUrl: 'https://example.com',
      slug: 'unico',
    })

    const uploader = createInMemoryUploader()

    await exportLinks({ uploader })
    const first = uploader.lastKey()

    await exportLinks({ uploader })
    const second = uploader.lastKey()

    expect(first).toMatch(/^exports\/.+-links\.csv$/)
    expect(second).not.toBe(first)
  })

  it('devolve a reportUrl apontando para o objeto enviado', async () => {
    await db.insert(schema.links).values({
      originalUrl: 'https://example.com',
      slug: 'relatorio',
    })

    const uploader = createInMemoryUploader()
    const result = await exportLinks({ uploader })

    if (isLeft(result)) throw new Error('esperava sucesso')

    expect(unwrapEither(result).reportUrl).toContain(uploader.lastKey())
  })
})
