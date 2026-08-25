export const ROUTES = {
  home: '/',
  redirect: '/:slug',
  notFound: '*',

  redirectTo(slug: string) {
    return `/${slug}`
  },
} as const

/**
 * Caminhos estáticos que a aplicação ocupa, além da raiz.
 *
 * ⚠️ Toda entrada aqui precisa estar em RESERVED_SLUGS no servidor
 * (`server/src/infra/shared/reserved-slugs.ts`) — senão um apelido com esse nome é
 * criado com sucesso e fica permanentemente inalcançável.
 *
 * Isso é verificado: `routes.spec.ts` confronta esta lista com a do servidor e
 * quebra se alguma entrada aqui não estiver reservada lá.
 *
 * Hoje vazio: a tela de link não encontrado é renderizada DENTRO de `/:slug`,
 * e não como rota própria. O diretório `/assets/` do build do Vite não
 * é rota do React, mas está reservado no servidor pelo mesmo motivo.
 */
export const STATIC_PATHS: string[] = []
