import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['./tsconfig.vitest.json'] })],
  test: {
    setupFiles: ['./src/test/setup.ts'],
    fileParallelism: false,
    include: ['src/**/*.spec.ts'],
  },
})
