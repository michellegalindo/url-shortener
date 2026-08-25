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

// 2048 é o limite prático de URL na maioria dos navegadores e proxies; a
// coluna é `text`, então sem isso um endpoint público aceitaria megabytes
export const originalUrlSchema = z
  .url({
    protocol: /^https?$/,
    error: 'Informe uma URL válida',
  })
  .max(2048, 'A URL deve ter no máximo 2048 caracteres')
