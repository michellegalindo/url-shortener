import { useInfiniteQuery } from '@tanstack/react-query'
import { api, type Link } from '@/lib/api'

type LinksPage = { links: Link[]; nextCursor: string | null }

export function useLinks() {
  return useInfiniteQuery({
    queryKey: ['links'],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' })

      if (pageParam) {
        params.set('cursor', pageParam)
      }

      return api<LinksPage>(`/links?${params}`)
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
  })
}
