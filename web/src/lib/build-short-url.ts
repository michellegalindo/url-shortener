import { env } from '@/env'

export function buildShortUrl(
  slug: string,
  base: string = env.VITE_FRONTEND_URL
): string {
  return `${base.replace(/\/$/, '')}/${slug}`
}
