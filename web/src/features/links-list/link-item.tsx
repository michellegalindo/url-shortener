import { CopyIcon, TrashIcon } from '@phosphor-icons/react'
import { IconButton } from '@/components/ui/icon-button'
import type { Link } from '@/lib/api'
import { buildShortUrl } from '@/lib/build-short-url'
import { formatDate } from '@/lib/format-date'

type LinkItemProps = {
  link: Link
  onCopy: (shortUrl: string) => void
  onDelete: (link: Link) => void
  isDeleting: boolean
}

export function LinkItem({
  link,
  onCopy,
  onDelete,
  isDeleting,
}: LinkItemProps) {
  const shortUrl = buildShortUrl(link.slug)

  return (
    <li className="flex items-center justify-between gap-4 border-t border-gray-200 py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <a
          href={shortUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-md text-blue-base hover:underline focus-visible:outline-2 focus-visible:outline-blue-base focus-visible:outline-offset-2"
        >
          {shortUrl.replace(/^https?:\/\//, '')}
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
          label={`Copiar ${shortUrl}`}
          onClick={() => onCopy(shortUrl)}
        />
        <IconButton
          icon={<TrashIcon />}
          label={`Excluir ${shortUrl}`}
          loading={isDeleting}
          onClick={() => onDelete(link)}
        />
      </div>
    </li>
  )
}
