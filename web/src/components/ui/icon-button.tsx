import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './spinner'

type IconButtonProps = ComponentProps<'button'> & {
  icon: ReactNode
  /** anunciado por leitores de tela; `title` não é lido de forma confiável */
  label: string
  loading?: boolean
}

export function IconButton({
  icon,
  label,
  loading = false,
  className,
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-busy={loading}
      disabled={disabled || loading}
      className={cn(
        'flex size-8 cursor-pointer items-center justify-center rounded-sm',
        'bg-gray-200 text-gray-600 ring-1 ring-transparent transition-colors',
        'hover:ring-blue-base',
        'focus-visible:outline-2 focus-visible:outline-blue-base focus-visible:outline-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      {...props}
    >
      {loading ? <Spinner /> : icon}
    </button>
  )
}
