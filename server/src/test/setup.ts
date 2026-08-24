import { sql } from 'drizzle-orm'
import { afterAll, beforeEach } from 'vitest'
import { db, pg } from '@/infra/db'

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE links RESTART IDENTITY CASCADE`)
})

afterAll(async () => {
  await pg.end()
})
