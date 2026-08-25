import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Link } from '@/lib/api'

export function useCreateLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: { originalUrl: string; slug: string }) =>
      api<Link>('/links', {
        method: 'POST',
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links'] })
    },
  })
}
