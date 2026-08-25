import { WarningIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { Link } from '@/lib/api'
import { LinkItem } from './link-item'
import { LinksListEmpty } from './links-list-empty'
import { LinksListSkeleton } from './links-list-skeleton'
import { useLinks } from './use-links'

type LinksListProps = {
  onCopy: (shortUrl: string) => void
  onDelete: (link: Link) => void
  deletingSlug: string | null
  leavingSlug: string | null
  onLeaveEnd: (slug: string) => void
}

export function LinksList({
  onCopy,
  onDelete,
  deletingSlug,
  leavingSlug,
  onLeaveEnd,
}: LinksListProps) {
  const {
    data,
    isPending,
    isError,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useLinks()

  const sentinelRef = useRef<HTMLLIElement>(null)

  // uma página por vez: enquanto a última página ainda entra em cascata, o
  // observer não pede a próxima — senão a de baixo aparece antes da de cima.
  // Liga quando uma página além da primeira chega; o último item dela
  // desliga quando COMEÇA a animar (onAnimationStart): a página seguinte
  // nunca chega antes disso, então a ordem se mantém sem esperar o fim da
  // cascata inteira (declarativo, sem timer)
  const [isEntering, setIsEntering] = useState(false)
  const pageCount = data?.pages.length ?? 0
  const lastPageSize = data?.pages.at(-1)?.links.length ?? 0

  useEffect(() => {
    if (pageCount > 1 && lastPageSize > 0) setIsEntering(true)
  }, [pageCount, lastPageSize])

  useEffect(() => {
    const sentinel = sentinelRef.current

    if (!sentinel || !hasNextPage || isEntering) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      // root padrão (viewport): a paginação usa o scroll nativo da página, sem
      // rolagem própria no card. rootMargin antecipa a próxima página antes
      // de o sentinela entrar na tela
      { rootMargin: '200px', threshold: 0 }
    )

    observer.observe(sentinel)

    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isEntering])

  if (isPending) {
    return <LinksListSkeleton />
  }

  // ausência ≠ falha: sem dado nenhum por erro de query, o usuário
  // precisa ver que a busca falhou, não que a lista está vazia. Uma falha ao
  // buscar a PRÓXIMA página não cai aqui — a lista já carregada permanece.
  if (isError && !data) {
    return (
      <div className="flex flex-col items-center gap-3 border-t border-gray-200 px-3 py-8">
        <WarningIcon className="size-8 text-gray-400" aria-hidden />
        <p className="text-xs uppercase text-gray-500">
          não foi possível carregar os links
        </p>
        <Button variant="secondary" density="compact" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  // guarda de qual página cada link veio: as páginas seguintes entram em
  // cascata, a primeira não (ela já tem o skeleton)
  const links =
    data?.pages.flatMap((page, pageIndex) =>
      page.links.map((link, indexInPage) => ({ link, pageIndex, indexInPage }))
    ) ?? []

  if (links.length === 0) {
    return <LinksListEmpty />
  }

  return (
    <div className="relative">
      {/* skeleton só na primeira carga (isPending): a revalidação por
          isFetching não tem indicador — dura milissegundos, e uma barra no
          topo da lista se confundia com a borda do link recém-criado */}
      <ul>
        {links.map(({ link, pageIndex, indexInPage }) => (
          <LinkItem
            key={link.slug}
            link={link}
            onCopy={onCopy}
            onDelete={onDelete}
            isDeleting={deletingSlug === link.slug}
            isLeaving={leavingSlug === link.slug}
            onLeaveEnd={() => onLeaveEnd(link.slug)}
            enterDelayMs={pageIndex > 0 ? indexInPage * 40 : null}
            onEnterStart={
              pageIndex === pageCount - 1 && indexInPage === lastPageSize - 1
                ? () => setIsEntering(false)
                : undefined
            }
          />
        ))}

        {hasNextPage && (
          <li ref={sentinelRef} className="flex justify-center py-4">
            {isFetchingNextPage && <Spinner className="text-gray-400" />}
          </li>
        )}

        {/* só depois de paginar: numa lista que coube numa página o aviso
            seria ruído */}
        {!hasNextPage && pageCount > 1 && (
          <li className="border-t border-gray-200 pt-6 pb-4 text-center text-sm text-gray-300">
            Todos os links carregados
          </li>
        )}
      </ul>
    </div>
  )
}
