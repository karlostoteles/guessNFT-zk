import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // pino CJS browser stub doesn't export named 'pino' — bb.js imports it
      // as ESM. Redirect to a no-op stub so bb.js logger resolves silently.
      'pino': path.resolve(__dirname, 'src/zk/pino-stub.ts'),
    },
    dedupe: ['react', 'react-dom', '@react-three/fiber'],
  },
  plugins: [
    wasm(),
    topLevelAwait(),
    react(),
    nodePolyfills({
      include: ['buffer', 'process', 'stream', 'util'],
      globals: {
        Buffer: true,
        process: true,
      },
    }),
  ],
  define: {
    global: 'globalThis',
  },

  // COOP+COEP: required for SharedArrayBuffer (bb.js WASM multi-threading)
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      '/api/nft-img': {
        target: 'https://v1assets.schizod.io',
        changeOrigin: true,
        rewrite: (rawPath) => {
          const [, query = ''] = rawPath.split('?');
          const params = new URLSearchParams(query);
          const hash = params.get('hash');
          return hash ? `/images/revealed/${hash}.png` : '/images/revealed/invalid.png';
        },
      },
      '/world.World': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },

  // WASM packages break if Vite pre-bundles them:
  // - @aztec/bb.js: WASM multi-threading
  // - @noir-lang/*: use `new URL('*.wasm', import.meta.url)` which resolves
  //   wrong after bundling (especially in Web Workers → returns index.html)
  // WASM files also copied to public/ as fallback for worker context.
  optimizeDeps: {
    exclude: ['@aztec/bb.js', '@noir-lang/noir_js', '@noir-lang/acvm_js', '@noir-lang/noirc_abi'],
  },

  // Web Workers must use ES module format for top-level imports
  worker: { format: 'es' },

  build: {
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'cartridge': ['@cartridge/controller'],
          'starknet': ['starknet', 'starkzap'],
          'react-vendor': ['react', 'react-dom', 'framer-motion'],
        },
      },
    },
  },
})
