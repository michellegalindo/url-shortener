import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useExportLinks() {
  return useMutation({
    mutationFn: () =>
      api<{ reportUrl: string }>('/links/exports', { method: 'POST' }),
    // explícito, embora seja o padrão de mutations: cada chamada varre a
    // tabela e cria um objeto novo no R2 — repetir custa dinheiro
    retry: 0,
  })
}
