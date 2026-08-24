import cors from '@fastify/cors'
import { fastify } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import { env } from '@/env'
import { registerErrorHandler } from './error-handler'
import { createLinkRoute } from './routes/create-link'

export async function buildApp() {
  const app = fastify({ logger: { level: 'warn' } })

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  registerErrorHandler(app)

  const origins = env.FRONTEND_URL.split(',').map(o => o.trim())

  await app.register(cors, { origin: origins })

  await app.register(createLinkRoute)

  return app
}
