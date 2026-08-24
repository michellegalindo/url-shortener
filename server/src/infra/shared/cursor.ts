import { z } from 'zod'

// formas do Zod 4: z.iso.datetime() e z.uuid()
const cursorPayload = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
})

export type CursorAnchor = { createdAt: Date; id: string }

export function encodeCursor(input: CursorAnchor): string {
  const payload = JSON.stringify({
    createdAt: input.createdAt.toISOString(),
    id: input.id,
  })

  return Buffer.from(payload, 'utf8').toString('base64url')
}

export function decodeCursor(cursor: string): CursorAnchor | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8')
    const parsed = cursorPayload.safeParse(JSON.parse(raw))

    if (!parsed.success) return null

    return {
      createdAt: new Date(parsed.data.createdAt),
      id: parsed.data.id,
    }
  } catch {
    return null
  }
}
