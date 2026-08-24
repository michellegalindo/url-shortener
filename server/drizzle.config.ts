import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infra/db/schemas/links.ts',
  out: './src/infra/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
})
