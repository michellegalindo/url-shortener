import { z } from 'zod'

// Mesmo schema do servidor (server/src/infra/shared/schemas.ts), repetido de
// propósito: valida no cliente para dar retorno imediato, e o servidor
// revalida porque nunca confia no cliente. As regras precisam bater — a
// restrição de protocolo e o limite de tamanho da URL vêm de lá, senão o
// formulário aceitaria algo que a API recusa com 400.
export const createLinkSchema = z.object({
  originalUrl: z
    .string()
    .transform(value => value.trim())
    // igual ao servidor: `linkedin.com/in/x` ganha https:// antes de validar
    .transform(value =>
      /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`
    )
    .pipe(
      z
        .url({
          protocol: /^https?$/,
          // z.url() aceita qualquer host sintaticamente válido, inclusive `http://w`;
          // exige um domínio com TLD (ex.: example.com); `www.` na frente não
          // conta como rótulo, senão `www.petlove` passaria. `localhost` (com ou
          // sem porta) entra para testar o redirect em desenvolvimento; IP puro
          // fica de fora
          hostname:
            /^(?:localhost|(?!www\.[a-z0-9-]+$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})$/i,
          error: 'Informe uma URL válida.',
        })
        .max(2048, 'A URL deve ter no máximo 2048 caracteres.')
    ),
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
