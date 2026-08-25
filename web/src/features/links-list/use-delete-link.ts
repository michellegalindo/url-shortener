import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useDeleteLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (slug: string) =>
      api<void>(`/links/${encodeURIComponent(slug)}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links'] })
    },
  })
}
