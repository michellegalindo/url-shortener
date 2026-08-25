/**
 * Marca exibida na interface. É texto de apresentação, como no Figma — a URL
 * real (href, cópia, CSV) vem de VITE_FRONTEND_URL via `buildShortUrl`.
 */
export const BRAND_NAME = 'Brev.ly'
export const BRAND_DOMAIN = 'brev.ly'

/** Forma curta exibida para um slug: `brev.ly/meu-link`. */
export function displayShortUrl(slug: string): string {
  return `${BRAND_DOMAIN}/${slug}`
}
