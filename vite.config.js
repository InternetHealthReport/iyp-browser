import { fileURLToPath, URL } from 'node:url'
import { basePath } from './src/plugins/GlobalVariables'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'
import monacoEditorPlugin from 'vite-plugin-monaco-editor'

// https://vite.dev/config/
export default defineConfig({
  base: basePath,
  plugins: [
    vue({
      template: { transformAssetUrls }
    }),
    vueDevTools(),
    quasar(),
    monacoEditorPlugin.default({}),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  optimizeDeps: {
    exclude: [
      '@neo4j-nvl/layout-workers',
    ],
    include: [
      '@neo4j-nvl/layout-workers > cytoscape',
      '@neo4j-nvl/layout-workers > cytoscape-cose-bilkent',
      '@neo4j-nvl/layout-workers > @neo4j-bloom/dagre',
      '@neo4j-nvl/layout-workers > bin-pack',
      '@neo4j-nvl/layout-workers > graphlib',
    ]
  }
})
