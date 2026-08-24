import { z } from 'zod'

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
