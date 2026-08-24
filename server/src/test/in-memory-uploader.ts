import type { Uploader } from '@/infra/storage/uploader'

export type InMemoryUploader = Uploader & {
  lastBody(): string
  lastKey(): string
  lastContentDisposition(): string
  count(): number
}

export function createInMemoryUploader(
  publicUrl = 'http://localhost:9999'
): InMemoryUploader {
  const uploads: { key: string; body: string; contentDisposition: string }[] =
    []

  return {
    async upload({ key, contentDisposition, body }) {
      const chunks: Buffer[] = []

      for await (const chunk of body) {
        chunks.push(Buffer.from(chunk))
      }

      uploads.push({
        key,
        body: Buffer.concat(chunks).toString('utf8'),
        contentDisposition,
      })

      return { key, url: `${publicUrl}/${key}` }
    },
    lastBody: () => uploads.at(-1)?.body ?? '',
    lastKey: () => uploads.at(-1)?.key ?? '',
    lastContentDisposition: () => uploads.at(-1)?.contentDisposition ?? '',
    count: () => uploads.length,
  }
}
