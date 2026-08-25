import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { env } from '@/env'
import { ApiError, api, type Link } from '@/lib/api'

/**
 * Tempo mínimo com a tela "Redirecionando..." visível: 1 s além do atraso
 * artificial da API (com o padrão de 250 ms dá 1,25 s; com 0, ainda 1 s).
 * Com a API local a resposta chega em poucos ms e a tela virava um flash
 * ilegível; o contador de acessos NÃO espera esse tempo — só a navegação.
 */
const MIN_DISPLAY_BASE_MS = 1000

const MIN_DISPLAY_MS = MIN_DISPLAY_BASE_MS + env.VITE_API_DELAY_MS

const wait = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, Math.max(0, ms)))

export function useRedirect(slug: string) {
  // ref e não state: em StrictMode (dev) o efeito roda duas vezes antes que
  // uma atualização de estado dispare o re-render que o guardaria, então o
  // PATCH /visits saía duas vezes e o contador dobrava em desenvolvimento.
  // Um ref é lido/escrito de forma síncrona dentro do próprio efeito.
  const hasRedirected = useRef(false)
  const shownAt = useRef(Date.now())

  const query = useQuery({
    queryKey: ['redirect', slug],
    queryFn: () => api<Link>(`/links/${encodeURIComponent(slug)}`),
    enabled: slug.length > 0,
    // repetir automaticamente um 404 é inútil e só atrasa a mensagem correta
    retry: false,
  })

  const originalUrl = query.data?.originalUrl

  useEffect(() => {
    if (!originalUrl || hasRedirected.current) return

    hasRedirected.current = true

    async function go(url: string) {
      // keepalive: sem ele o navegador aborta a requisição em voo ao iniciar
      // a navegação, e a contagem sobe de forma intermitente
      const countVisit = fetch(
        `${env.VITE_BACKEND_URL}/links/${encodeURIComponent(slug)}/visits`,
        {
          method: 'PATCH',
          keepalive: true,
        }
      ).catch(() => {
        // falhar o contador não pode impedir o redirecionamento
      })

      // contado desde a montagem, não desde a resposta: uma API lenta já
      // consumiu parte (ou todo) o tempo mínimo
      await Promise.all([
        countVisit,
        wait(MIN_DISPLAY_MS - (Date.now() - shownAt.current)),
      ])

      // replace e não href: href empilha esta página no histórico, e como ela
      // redireciona ao montar, o botão Voltar reexecuta o redirect
      window.location.replace(url)
    }

    void go(originalUrl)
  }, [originalUrl, slug])

  const error = query.error

  return {
    originalUrl,
    // 404 e falha de transporte são estados distintos
    isNotFound: error instanceof ApiError && error.status === 404,
    isUnavailable:
      error instanceof ApiError && error.status !== 404 ? error : null,
    retry: query.refetch,
  }
}
