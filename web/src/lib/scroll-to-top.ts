const DEFAULT_DURATION_MS = 300

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

/**
 * Rola a página ao topo em `durationMs` e resolve ao chegar. Rolagem própria
 * em vez de `behavior: 'smooth'`: a nativa tem velocidade fixa (lenta em
 * páginas longas) e não avisa quando termina. Instantânea para quem pede
 * menos movimento.
 */
export function scrollToTop(
  durationMs: number = DEFAULT_DURATION_MS
): Promise<void> {
  const from = window.scrollY
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches

  if (from === 0 || reduceMotion || durationMs <= 0) {
    window.scrollTo({ top: 0, behavior: 'auto' })
    return Promise.resolve()
  }

  return new Promise(resolve => {
    const start = performance.now()

    function step(now: number) {
      const progress = Math.min((now - start) / durationMs, 1)

      window.scrollTo(0, from * (1 - easeOutCubic(progress)))

      if (progress < 1) {
        requestAnimationFrame(step)
      } else {
        resolve()
      }
    }

    requestAnimationFrame(step)
  })
}
