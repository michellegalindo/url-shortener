/**
 * Slugs que colidiriam com caminhos servidos pelo front.
 *
 * A URL curta é `${FRONTEND_URL}/${slug}`, então a colisão é com caminhos do
 * FRONT — não da API, que roda em outra origem. Um slug colidente seria
 * criado com sucesso e ficaria inalcançável para sempre, sem erro nenhum.
 *
 * `assets`: o Vite emite os arquivos compilados sob `/assets/`.
 *
 * Fora da lista, e por quê:
 * - `not-found`: a tela de link não encontrado é renderizada DENTRO da rota
 *   `/:slug` quando a API devolve 404. Não existe rota estática para ela.
 * - `api`, `docs`: rotas do servidor, em outra origem. Só colidiriam se front
 *   e API compartilhassem domínio atrás de um proxy reverso.
 *
 * ⚠️ Ao adicionar uma rota estática no front, ou ao publicar a API sob o mesmo
 * domínio, acrescente o caminho aqui.
 */
export const RESERVED_SLUGS = ['assets'] as const

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(
    slug.trim().toLowerCase() as (typeof RESERVED_SLUGS)[number]
  )
}
