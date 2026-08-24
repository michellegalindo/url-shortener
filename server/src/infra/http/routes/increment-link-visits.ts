import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { incrementLinkVisits } from '@/app/functions/increment-link-visits'
import { isLeft, unwrapEither } from '@/infra/shared/either'
import { errorSchema } from '../schemas'

export const incrementLinkVisitsRoute: FastifyPluginAsyncZod = async app => {
  app.patch(
    '/links/:slug/visits',
    {
      schema: {
        summary: 'Incrementa a contagem de acessos de um link',
        tags: ['links'],
        params: z.object({ slug: z.string() }),
        response: { 204: z.void(), 400: errorSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const result = await incrementLinkVisits(request.params)

      if (isLeft(result)) {
        throw unwrapEither(result)
      }

      // o use-case devolve { accessCount }, descartado aqui: a resposta é 204
      return reply.status(204).send()
    }
  )
}
