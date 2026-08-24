import cors from '@fastify/cors'
import { fastifySwagger } from '@fastify/swagger'
import scalar from '@scalar/fastify-api-reference'
import { fastify } from 'fastify'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import { env } from '@/env'
import { registerErrorHandler } from './error-handler'
import { createLinkRoute } from './routes/create-link'
import { deleteLinkRoute } from './routes/delete-link'
import { exportLinksRoute } from './routes/export-links'
import { getLinkBySlugRoute } from './routes/get-link-by-slug'
import { incrementLinkVisitsRoute } from './routes/increment-link-visits'
import { listLinksRoute } from './routes/list-links'

export async function buildApp() {
  const app = fastify({ logger: { level: 'warn' } })

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  registerErrorHandler(app)

  const origins = env.FRONTEND_URL.split(',').map(o => o.trim())

  await app.register(cors, {
    origin: origins,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'],
  })

  await app.register(fastifySwagger, {
    openapi: {
      info: { title: 'Brev.ly API', version: '1.0.0' },
    },
    transform: jsonSchemaTransform,
  })

  await app.register(scalar, { routePrefix: '/docs' })

  await app.register(createLinkRoute)
  await app.register(listLinksRoute)
  await app.register(getLinkBySlugRoute)
  await app.register(incrementLinkVisitsRoute)
  await app.register(deleteLinkRoute)
  await app.register(exportLinksRoute)

  return app
}
