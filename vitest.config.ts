import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '~': resolve(__dirname, 'app'),
      '#imports': resolve(__dirname, '.nuxt/imports.d.ts'),
      '#shared': resolve(__dirname, 'shared'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['server/**/*.ts', 'app/composables/**/*.ts'],
      exclude: ['**/node_modules/**', '**/__tests__/**', '**/*.test.ts', '**/*.spec.ts'],
    },
  },
})
