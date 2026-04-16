import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@antv/x6': resolve(__dirname, '../../node_modules/@antv/x6/es/index.js'),
      '@x6-bpmn2/plugin': resolve(__dirname, 'src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    clearMocks: true,
    server: {
      deps: {
        inline: [/@antv\//],
      },
    },
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'text-summary', 'lcov', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/layout/**'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
    include: ['tests/**/*.test.ts'],
  },
})
