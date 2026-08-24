import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { exportLinks } from '@/app/functions/export-links'
import { isLeft, unwrapEither } from '@/infra/shared/either'
import { r2Uploader } from '@/infra/storage/r2-uploader'
import { errorSchema } from '../schemas'

export const exportLinksRoute: FastifyPluginAsyncZod = async app => {
  app.post(
    '/links/exports',
    {
      schema: {
        summary: 'Gera o CSV dos links e devolve a URL pública',
        tags: ['links'],
        response: {
          200: z.object({ reportUrl: z.string() }),
          422: errorSchema,
        },
      },
    },
    async (_request, reply) => {
      const result = await exportLinks({ uploader: r2Uploader })

      if (isLeft(result)) {
        throw unwrapEither(result)
      }

      return reply.status(200).send(unwrapEither(result))
    }
  )
}
