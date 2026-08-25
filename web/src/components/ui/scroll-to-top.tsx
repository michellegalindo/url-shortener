import { ArrowUpIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { scrollToTop } from '@/lib/scroll-to-top'

type ScrollToTopProps = {
  /** a partir de quantos px rolados o botão pode aparecer */
  threshold: number
}

/**
 * Botão flutuante para voltar ao topo. Aparece depois de rolar além do
 * `threshold` e some enquanto o usuário rola para cima — quem já está
 * subindo não precisa dele, e ele cobriria o conteúdo.
 */
export function ScrollToTop({ threshold }: ScrollToTopProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let lastY = window.scrollY

    function onScroll() {
      const y = window.scrollY
      const scrollingDown = y > lastY

      lastY = y
      setVisible(y > threshold && scrollingDown)
    }

    window.addEventListener('scroll', onScroll, { passive: true })

    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return (
    <button
      type="button"
      onClick={() => scrollToTop()}
      aria-label="Voltar ao topo"
      title="Voltar ao topo"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={cn(
        'fixed right-4 bottom-4 z-20 flex size-12 cursor-pointer items-center justify-center rounded-full',
        'bg-blue-base text-white shadow-lg transition-all duration-300',
        'hover:bg-blue-dark focus-visible:outline-2 focus-visible:outline-blue-dark focus-visible:outline-offset-2',
        'md:right-8 md:bottom-8',
        visible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-4 opacity-0'
      )}
    >
      <ArrowUpIcon className="size-5" weight="bold" aria-hidden />
    </button>
  )
}
