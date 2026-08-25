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
  .string()
  .transform(value => value.trim())
  // `linkedin.com/in/x` é o que as pessoas colam; sem esquema não é URL para
  // o z.url(). Prefixa https:// quando não há esquema algum — quem já tem
  // (`javascript:`, `file://`) passa adiante e cai na restrição de protocolo
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
        error: 'Informe uma URL válida',
      })
      .max(2048, 'A URL deve ter no máximo 2048 caracteres')
  )
