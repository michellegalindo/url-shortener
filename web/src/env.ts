import { z } from 'zod'

const envSchema = z.object({
  VITE_FRONTEND_URL: z.url(),
  VITE_BACKEND_URL: z.url(),
  VITE_API_DELAY_MS: z.coerce.number().int().min(0).default(0),
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(source: unknown): Env {
  const result = envSchema.safeParse(source)

  if (!result.success) {
    const details = result.error.issues
      .map(issue => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')

    throw new Error(`Variáveis de ambiente inválidas:\n${details}`)
  }

  return result.data
}

export const env = parseEnv(import.meta.env)
