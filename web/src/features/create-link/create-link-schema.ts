import { z } from 'zod'

// Mesmo schema do servidor (server/src/infra/shared/schemas.ts), repetido de
// propósito: valida no cliente para dar retorno imediato, e o servidor
// revalida porque nunca confia no cliente. As regras precisam bater — a
// restrição de protocolo e o limite de tamanho da URL vêm de lá, senão o
// formulário aceitaria algo que a API recusa com 400.
export const createLinkSchema = z.object({
  originalUrl: z
    .url({
      protocol: /^https?$/,
      error: 'Informe uma URL válida.',
    })
    .max(2048, 'A URL deve ter no máximo 2048 caracteres.'),
  slug: z
    .string()
    .transform(value => value.trim().toLowerCase())
    .pipe(
      z
        .string()
        .min(3, 'Use ao menos 3 caracteres.')
        .max(32, 'Use no máximo 32 caracteres.')
        .regex(
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
          'Use apenas letras minúsculas, números e hífens.'
        )
    ),
})

export type CreateLinkValues = z.input<typeof createLinkSchema>
