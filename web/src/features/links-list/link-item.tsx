import { CopyIcon, TrashIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { IconButton } from '@/components/ui/icon-button'
import type { Link } from '@/lib/api'
import { displayShortUrl } from '@/lib/brand'
import { buildShortUrl } from '@/lib/build-short-url'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format-date'

/** idade máxima para um link contar como "recém-criado" na entrada da lista */
const NEW_LINK_WINDOW_MS = 10_000

type LinkItemProps = {
  link: Link
  onCopy: (shortUrl: string) => void
  onDelete: (link: Link) => void
  isDeleting: boolean
  /** true entre a confirmação da API e o fim da animação de saída */
  isLeaving: boolean
  /** chamado quando a animação de saída termina */
  onLeaveEnd: () => void
  /** atraso da entrada em cascata (páginas do scroll); null = sem cascata */
  enterDelayMs: number | null
  /** chamado quando a entrada em cascata deste item começa */
  onEnterStart?: () => void
}

export function LinkItem({
  link,
  onCopy,
  onDelete,
  isDeleting,
  isLeaving,
  onLeaveEnd,
  enterDelayMs,
  onEnterStart,
}: LinkItemProps) {
  const shortUrl = buildShortUrl(link.slug)
  // o texto é a marca, como no Figma; href e cópia usam a URL real de
  // VITE_FRONTEND_URL — é ela que precisa funcionar quando colada
  const displayUrl = displayShortUrl(link.slug)

  // anima só o que acabou de ser criado: a primeira carga e as páginas do
  // scroll também montam itens novos, mas são links antigos. Decidido uma
  // vez, na montagem — re-renders não devem ligar nem desligar a animação
  const [isNew] = useState(
    () => Date.now() - new Date(link.createdAt).getTime() < NEW_LINK_WINDOW_MS
  )

  return (
    <li
      className={cn(
        'flex items-center justify-between gap-4 border-t border-gray-200 py-4',
        isNew && !isLeaving && 'link-enter',
        !isNew && !isLeaving && enterDelayMs !== null && 'page-enter',
        isLeaving && 'link-leave'
      )}
      aria-hidden={isLeaving || undefined}
      style={
        !isNew && enterDelayMs !== null
          ? { animationDelay: `${enterDelayMs}ms` }
          : undefined
      }
      onAnimationStart={event => {
        // só a cascata da página: link-enter e o spinner de excluir também
        // disparam animationstart (e o do spinner sobe por bubbling)
        if (event.animationName === 'page-enter') onEnterStart?.()
      }}
      onAnimationEnd={event => {
        // mesmo filtro: só a saída deste item, não animações de filhos
        if (event.animationName === 'link-leave') onLeaveEnd()
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <a
          href={shortUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-md text-blue-base hover:underline focus-visible:outline-2 focus-visible:outline-blue-base focus-visible:outline-offset-2"
        >
          {displayUrl}
        </a>

        {/* truncate: sem isso uma URL longa estoura o card no mobile */}
        <span
          className="truncate text-sm text-gray-500"
          title={link.originalUrl}
        >
          {link.originalUrl}
        </span>
      </div>

      <span
        className="shrink-0 text-sm text-gray-500"
        title={`Criado em ${formatDate(link.createdAt)}`}
      >
        {link.accessCount} {link.accessCount === 1 ? 'acesso' : 'acessos'}
      </span>

      <div className="flex shrink-0 gap-1">
        <IconButton
          icon={<CopyIcon />}
          label={`Copiar ${displayUrl}`}
          onClick={() => onCopy(shortUrl)}
        />
        <IconButton
          icon={<TrashIcon />}
          label={`Excluir ${displayUrl}`}
          tone="danger"
          loading={isDeleting}
          onClick={() => onDelete(link)}
        />
      </div>
    </li>
  )
}
