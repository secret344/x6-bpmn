import { defineConfig } from 'vite'
import { resolve } from 'node:path'

const PACKAGE_ROOT = resolve(__dirname)

export default defineConfig({
  root: resolve(PACKAGE_ROOT, 'tests/browser/harness'),
  resolve: {
    alias: {
      '@antv/x6': resolve(PACKAGE_ROOT, '../../node_modules/@antv/x6/es/index.js'),
    },
  },
  server: {
    open: false,
    fs: {
      allow: [PACKAGE_ROOT],
    },
  },
})