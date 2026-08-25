import { LinkIcon } from '@phosphor-icons/react'

export function LinksListEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 border-t border-gray-200 px-3 pt-10 pb-8">
      <LinkIcon className="size-8 text-gray-400" aria-hidden />
      <p className="text-xs uppercase text-gray-500">
        ainda não existem links cadastrados
      </p>
    </div>
  )
}
