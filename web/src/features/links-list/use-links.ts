import { useInfiniteQuery } from '@tanstack/react-query'
import { api, type Link } from '@/lib/api'

type LinksPage = { links: Link[]; nextCursor: string | null }

export function useLinks() {
  return useInfiniteQuery({
    queryKey: ['links'],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '15' })

      if (pageParam) {
        params.set('cursor', pageParam)
      }

      return api<LinksPage>(`/links?${params}`)
    },
    initialPageParam: undefined as string | undefined,
    // o acesso acontece em OUTRA aba (o link curto abre em target=_blank);
    // ao voltar para esta, refaz a busca mesmo dentro do staleTime, senão a
    // contagem de acessos só atualiza com F5. O padrão global segue false
    // para a query de redirect
    refetchOnWindowFocus: 'always',
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
  })
}
