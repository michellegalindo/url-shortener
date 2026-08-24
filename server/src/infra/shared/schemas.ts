import { z } from 'zod'

export const slugSchema = z
  .string()
  .transform(value => value.trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(3, 'O apelido deve ter ao menos 3 caracteres')
      .max(32, 'O apelido deve ter no máximo 32 caracteres')
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'Use apenas letras minúsculas, números e hífens'
      )
  )

export const originalUrlSchema = z.url({
  protocol: /^https?$/,
  error: 'Informe uma URL válida',
})
