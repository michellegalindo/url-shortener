import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { getLinkBySlug } from '@/app/functions/get-link-by-slug'
import { isLeft, unwrapEither } from '@/infra/shared/either'
import { errorSchema, linkSchema, linkToJson } from '../schemas'

export const getLinkBySlugRoute: FastifyPluginAsyncZod = async app => {
  app.get(
    '/links/:slug',
    {
      schema: {
        summary: 'Resolve um slug para a URL original',
        description: 'Não incrementa a contagem de acessos.',
        tags: ['links'],
        params: z.object({ slug: z.string() }),
        response: { 200: linkSchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const result = await getLinkBySlug(request.params)

      if (isLeft(result)) {
        throw unwrapEither(result)
      }

      const link = unwrapEither(result)

      return reply.status(200).send(linkToJson(link))
    }
  )
}
