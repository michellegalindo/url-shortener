import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { deleteLink } from '@/app/functions/delete-link'
import { isLeft, unwrapEither } from '@/infra/shared/either'
import { errorSchema } from '../schemas'

export const deleteLinkRoute: FastifyPluginAsyncZod = async app => {
  app.delete(
    '/links/:slug',
    {
      schema: {
        summary: 'Remove um link',
        tags: ['links'],
        params: z.object({ slug: z.string() }),
        response: { 204: z.void(), 400: errorSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const result = await deleteLink(request.params)

      if (isLeft(result)) {
        throw unwrapEither(result)
      }

      return reply.status(204).send()
    }
  )
}
