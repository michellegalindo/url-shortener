import type { InfiniteData } from '@tanstack/react-query'
import type { Link } from '@/lib/api'

export type LinksPage = { links: Link[]; nextCursor: string | null }

export type LinksCache = InfiniteData<LinksPage, string | undefined>

/**
 * Reduz o cache da listagem à primeira página. Invalidar uma infinite query
 * refaz TODAS as páginas carregadas, em sequência — quem rolou 8 páginas
 * dispara 8 requisições. Depois de criar um link a página volta ao topo, então
 * só a primeira página importa; as demais voltam sob demanda pelo scroll.
 */
export function keepFirstPage(data: LinksCache | undefined) {
  if (!data || data.pages.length <= 1) {
    return data
  }

  return {
    pages: data.pages.slice(0, 1),
    pageParams: data.pageParams.slice(0, 1),
  }
}

/**
 * Remove um link do cache sem refazer requisição. Seguro porque a paginação
 * é por cursor (keyset): tirar um item não desloca as páginas seguintes, então
 * os `pageParams` continuam válidos. A invalidação em segundo plano reconcilia
 * depois — sem ninguém esperando por ela.
 */
export function removeLink(slug: string) {
  return (data: LinksCache | undefined) => {
    if (!data) {
      return data
    }

    return {
      pages: data.pages.map(page => ({
        ...page,
        links: page.links.filter(link => link.slug !== slug),
      })),
      pageParams: data.pageParams,
    }
  }
}
