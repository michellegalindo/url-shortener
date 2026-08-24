import type { FastifyInstance } from 'fastify'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import { ZodError } from 'zod'

const STATUS_BY_ERROR_NAME: Record<string, number> = {
  SlugAlreadyExists: 409,
  SlugIsReserved: 409,
  LinkNotFound: 404,
  NoLinksToExport: 422,
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler<Error>((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        message: 'Dados inválidos.',
        issues: error.validation.map(issue => ({
          path: issue.instancePath.replace(/^\//, '') || 'body',
          message: issue.message ?? 'Valor inválido',
        })),
      })
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        message: 'Dados inválidos.',
        issues: error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      })
    }

    const status = STATUS_BY_ERROR_NAME[error.name]

    if (status) {
      return reply.status(status).send({ message: error.message })
    }

    // logger do Fastify, não console: sai estruturado e correlacionado
    // com a requisição (§4.8)
    request.log.error(error)

    return reply.status(500).send({ message: 'Erro interno do servidor.' })
  })
}
