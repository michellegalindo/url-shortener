import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Link } from '@/lib/api'
import { scrollToTop } from '@/lib/scroll-to-top'

export function useCreateLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: { originalUrl: string; slug: string }) =>
      api<Link>('/links', {
        method: 'POST',
        body: JSON.stringify(values),
      }),
    onSuccess: async () => {
      // só depois que a API confirmou: rola ao topo e SÓ ENTÃO revalida a
      // lista, para o link novo entrar com a animação inteira à vista —
      // invalidar antes faria ele aparecer no meio da rolagem
      await scrollToTop()
      await queryClient.invalidateQueries({ queryKey: ['links'] })
    },
  })
}
