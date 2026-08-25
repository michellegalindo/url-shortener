import type { ComponentProps } from 'react'
import { tv, type VariantProps } from 'tailwind-variants'
import { Spinner } from './spinner'

const button = tv({
  base: [
    'relative flex cursor-pointer items-center justify-center rounded-lg',
    'transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2',
    // pointer-events-none desliga o hover sozinho, dispensando prefixar
    // `enabled:` em cada regra
    'disabled:pointer-events-none disabled:opacity-50',
  ],
  variants: {
    variant: {
      primary:
        'bg-blue-base text-white hover:bg-blue-dark focus-visible:outline-blue-dark',
      secondary:
        'bg-gray-200 text-gray-500 hover:bg-gray-300 focus-visible:outline-blue-base',
      destructive:
        'bg-danger text-white hover:opacity-90 focus-visible:outline-danger',
    },
    density: {
      default: 'h-12 gap-3 px-5 text-md',
      compact: 'h-8 gap-1.5 rounded-sm px-2 text-sm',
    },
  },
  defaultVariants: { variant: 'primary', density: 'default' },
})

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof button> & { loading?: boolean }

export function Button({
  children,
  className,
  variant,
  density,
  loading = false,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={button({ variant, density, class: className })}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        // sobreposto em vez de substituir o conteúdo: trocar o texto por um
        // spinner encolheria o botão e deslocaria o que está ao lado.
        // rounded-[inherit]: o fundo é herdado, o raio não — sem isso o
        // overlay pinta um retângulo por cima dos cantos arredondados
        <span className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-inherit">
          <Spinner />
        </span>
      )}
      {children}
    </button>
  )
}
