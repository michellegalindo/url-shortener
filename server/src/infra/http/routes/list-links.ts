import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { listLinks } from '@/app/functions/list-links'
import { isLeft, unwrapEither } from '@/infra/shared/either'
import { errorSchema, linkSchema, linkToJson } from '../schemas'

export const listLinksRoute: FastifyPluginAsyncZod = async app => {
  app.get(
    '/links',
    {
      schema: {
        summary: 'Lista os links, do mais recente para o mais antigo',
        description: [
          'Retorna **todos** os links cadastrados, percorridos por páginas.',
          '',
          'Chame sem parâmetros para obter a primeira página. Enquanto',
          '`nextCursor` não for `null`, repita a chamada passando esse valor',
          'em `cursor` para receber a página seguinte — a concatenação das',
          'páginas é a lista completa.',
          '',
          'A paginação é por âncora (keyset), não por deslocamento: criar ou',
          'remover links durante a navegação não duplica nem esconde itens.',
        ].join('\n'),
        tags: ['links'],
        querystring: z.object({
          cursor: z
            .string()
            .optional()
            .describe('Cursor da página anterior. Omitir para a primeira.'),
          limit: z.coerce
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .describe('Itens por página. Padrão 20, máximo 100.'),
        }),
        response: {
          200: z.object({
            links: z.array(linkSchema),
            nextCursor: z.string().nullable(),
          }),
          400: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await listLinks(request.query)

      if (isLeft(result)) {
        throw unwrapEither(result)
      }

      const page = unwrapEither(result)

      return reply.status(200).send({
        links: page.links.map(linkToJson),
        nextCursor: page.nextCursor,
      })
    }
  )
}
