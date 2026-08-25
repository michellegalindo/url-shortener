import { WarningIcon } from '@phosphor-icons/react'
import { useEffect, useRef } from 'react'
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
}

export function LinksList({ onCopy, onDelete, deletingSlug }: LinksListProps) {
  const {
    data,
    isPending,
    isError,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useLinks()

  const scrollRef = useRef<HTMLUListElement>(null)
  const sentinelRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current

    if (!sentinel || !hasNextPage) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      // root é a LISTA, não a janela: o scroll acontece dentro do card, e com
      // o root padrão o sentinela nunca entra em interseção — a lista para de
      // carregar ao chegar no fim, sem erro nenhum (§5.3)
      { root: scrollRef.current, threshold: 0.1 }
    )

    observer.observe(sentinel)

    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  if (isPending) {
    return <LinksListSkeleton />
  }

  // ausência ≠ falha (D18): sem dado nenhum por erro de query, o usuário
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

  const links = data?.pages.flatMap(page => page.links) ?? []

  if (links.length === 0) {
    return <LinksListEmpty />
  }

  return (
    <div className="relative">
      {/* barra fina no revalidar, skeleton só na primeira carga: disparar o
          skeleton por isFetching faria a lista sumir a cada criação ou
          remoção de link (§5.3) */}
      {isFetching && !isFetchingNextPage && (
        <div
          className="absolute inset-x-0 top-0 h-0.5 overflow-hidden"
          aria-hidden
        >
          <div className="h-full w-1/3 animate-pulse bg-blue-base" />
        </div>
      )}

      <ul ref={scrollRef} className="max-h-[26rem] overflow-y-auto">
        {links.map(link => (
          <LinkItem
            key={link.slug}
            link={link}
            onCopy={onCopy}
            onDelete={onDelete}
            isDeleting={deletingSlug === link.slug}
          />
        ))}

        {hasNextPage && (
          <li ref={sentinelRef} className="flex justify-center py-4">
            {isFetchingNextPage && <Spinner className="text-gray-400" />}
          </li>
        )}
      </ul>
    </div>
  )
}
