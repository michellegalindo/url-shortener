import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './spinner'

type IconButtonProps = ComponentProps<'button'> & {
  icon: ReactNode
  /** anunciado por leitores de tela; `title` não é lido de forma confiável */
  label: string
  loading?: boolean
  /** cor que o botão assume no hover/foco: marca (padrão) ou perigo */
  tone?: 'brand' | 'danger'
}

export function IconButton({
  icon,
  label,
  loading = false,
  tone = 'brand',
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
        'bg-gray-200 text-gray-600 transition-colors',
        'hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2',
        tone === 'danger'
          ? 'hover:bg-danger focus-visible:outline-danger'
          : 'hover:bg-blue-base focus-visible:outline-blue-base',
        'disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      {...props}
    >
      {loading ? <Spinner /> : icon}
    </button>
  )
}
