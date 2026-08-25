import { env } from '@/env'
import { buildApp } from './app'

const app = await buildApp()

await app.listen({ port: env.PORT, host: '0.0.0.0' })

const origins = env.FRONTEND_URL.split(',').map(o => o.trim())

// logar as origens permitidas: CORS mal configurado falha no navegador,
// sem nenhum sinal do lado do servidor
app.log.warn(`Servidor em http://localhost:${env.PORT}`)
app.log.warn(`Origens de CORS permitidas: ${origins.join(', ')}`)
