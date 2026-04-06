import { defineConfig } from 'vite'
import { resolve } from 'node:path'

const PACKAGE_ROOT = resolve(__dirname)
const WORKSPACE_ROOT = resolve(PACKAGE_ROOT, '../..')
const ROOT_NODE_MODULES = resolve(WORKSPACE_ROOT, 'node_modules')

export default defineConfig({
  root: resolve(PACKAGE_ROOT, 'tests/browser/harness'),
  resolve: {
    alias: {
      '@antv/x6': resolve(PACKAGE_ROOT, '../../node_modules/@antv/x6/es/index.js'),
      '@antv/x6-plugin-selection': resolve(PACKAGE_ROOT, '../../node_modules/@antv/x6/es/plugin/selection/index.js'),
      '@antv/x6-plugin-transform': resolve(PACKAGE_ROOT, '../../node_modules/@antv/x6/es/plugin/transform/index.js'),
    },
  },
  server: {
    open: false,
    fs: {
      allow: [PACKAGE_ROOT, WORKSPACE_ROOT, ROOT_NODE_MODULES],
    },
  },
})