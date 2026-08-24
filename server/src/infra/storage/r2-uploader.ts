import { Upload } from '@aws-sdk/lib-storage'
import { env } from '@/env'
import { r2 } from './client'
import type { Uploader } from './uploader'

export const r2Uploader: Uploader = {
  async upload({ key, contentType, contentDisposition, body }) {
    // Upload (multipart) e não PutObjectCommand: este exige Content-Length
    // conhecido de antemão, impossível com stream de tamanho desconhecido.
    // Cuidado: o buffer é partSize × queueSize — aumentar partSize multiplica
    // o consumo mínimo de memória (§4.5).
    const upload = new Upload({
      client: r2,
      params: {
        Bucket: env.CLOUDFLARE_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        // habilita o download no front sem bloqueio de popup (§5.4)
        ContentDisposition: contentDisposition,
      },
    })

    await upload.done()

    return {
      key,
      url: `${env.CLOUDFLARE_PUBLIC_URL.replace(/\/$/, '')}/${key}`,
    }
  },
}
