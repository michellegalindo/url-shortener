import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { api } from '@/lib/api'
import { removeLink } from './links-cache'

/** Chama a API. Não mexe no cache: o item ainda precisa animar a saída. */
export function useDeleteLink() {
  return useMutation({
    mutationFn: (slug: string) =>
      api<void>(`/links/${encodeURIComponent(slug)}`, { method: 'DELETE' }),
  })
}

/**
 * Segundo passo da exclusão, depois da animação de saída: tira o link do
 * cache (some sem refetch) e invalida em segundo plano só para reconciliar —
 * com N páginas carregadas a invalidação faz N requisições em série, e nada
 * pode ficar esperando por ela.
 */
export function useCommitLinkRemoval() {
  const queryClient = useQueryClient()

  return useCallback(
    (slug: string) => {
      queryClient.setQueryData(['links'], removeLink(slug))
      queryClient.invalidateQueries({ queryKey: ['links'] })
    },
    [queryClient]
  )
}
