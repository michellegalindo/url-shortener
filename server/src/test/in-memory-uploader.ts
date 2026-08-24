import type { Uploader } from '@/infra/storage/uploader'

export type InMemoryUploader = Uploader & {
  lastBody(): string
  lastKey(): string
  count(): number
}

export function createInMemoryUploader(
  publicUrl = 'http://localhost:9999'
): InMemoryUploader {
  const uploads: { key: string; body: string }[] = []

  return {
    async upload({ key, body }) {
      const chunks: Buffer[] = []

      for await (const chunk of body) {
        chunks.push(Buffer.from(chunk))
      }

      uploads.push({ key, body: Buffer.concat(chunks).toString('utf8') })

      return { key, url: `${publicUrl}/${key}` }
    },
    lastBody: () => uploads.at(-1)?.body ?? '',
    lastKey: () => uploads.at(-1)?.key ?? '',
    count: () => uploads.length,
  }
}
