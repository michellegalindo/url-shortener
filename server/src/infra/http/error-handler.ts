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

    // erros 4xx do próprio Fastify (JSON malformado, Content-Type não
    // suportado, etc.) chegam aqui com statusCode já definido: respeitá-lo
    // evita reportar erro de cliente como 500 e poluir os logs (§4.3)
    const frameworkStatus = (error as { statusCode?: number }).statusCode

    if (
      typeof frameworkStatus === 'number' &&
      frameworkStatus >= 400 &&
      frameworkStatus < 500
    ) {
      return reply.status(frameworkStatus).send({ message: error.message })
    }

    // logger do Fastify, não console: sai estruturado e correlacionado
    // com a requisição (§4.8)
    request.log.error(error)

    return reply.status(500).send({ message: 'Erro interno do servidor.' })
  })
}
