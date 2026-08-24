import { z } from 'zod'
import type { LinkOutput } from '@/app/functions/create-link'

export const linkSchema = z.object({
  originalUrl: z.string(),
  slug: z.string(),
  accessCount: z.number().int(),
  createdAt: z.string(),
})

export const errorSchema = z.object({
  message: z.string(),
  issues: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .optional(),
})

export function linkToJson(link: LinkOutput) {
  return {
    originalUrl: link.originalUrl,
    slug: link.slug,
    accessCount: link.accessCount,
    createdAt: link.createdAt.toISOString(),
  }
}
