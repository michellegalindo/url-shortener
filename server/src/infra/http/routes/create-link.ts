import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { createLink } from '@/app/functions/create-link'
import { isLeft, unwrapEither } from '@/infra/shared/either'
import { errorSchema, linkSchema, linkToJson } from '../schemas'

export const createLinkRoute: FastifyPluginAsyncZod = async app => {
  app.post(
    '/links',
    {
      schema: {
        summary: 'Cria um link encurtado',
        tags: ['links'],
        body: z.object({
          originalUrl: z.string(),
          slug: z.string(),
        }),
        response: {
          201: linkSchema,
          400: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await createLink(request.body)

      if (isLeft(result)) {
        throw unwrapEither(result)
      }

      const link = unwrapEither(result)

      return reply.status(201).send(linkToJson(link))
    }
  )
}
