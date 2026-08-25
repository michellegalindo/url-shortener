import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    env: {
      VITE_FRONTEND_URL: 'http://localhost:5173',
      VITE_BACKEND_URL: 'http://localhost:3333',
      VITE_API_DELAY_MS: '0',
    },
  },
})
