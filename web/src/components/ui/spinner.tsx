import { CircleNotchIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'

export function Spinner({ className }: { className?: string }) {
  return (
    <CircleNotchIcon
      className={cn('size-4 animate-spin', className)}
      weight="bold"
      aria-hidden
    />
  )
}
