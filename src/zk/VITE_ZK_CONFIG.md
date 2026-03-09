# Vite ZK Configuration

Post-merge, add these settings to `vite.config.ts`:

## 1. COOP/COEP Headers (required for SharedArrayBuffer / WASM threads)

```ts
server: {
  headers: {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  },
}
```

## 2. Exclude @aztec/bb.js from optimizeDeps

The WASM binary breaks if Vite pre-bundles it:

```ts
optimizeDeps: {
  exclude: ['@aztec/bb.js'],
}
```

## 3. Web Worker format

Workers must use ES modules for dynamic import to work:

```ts
worker: {
  format: 'es',
}
```

## 4. Torii proxy (dev only)

Proxy Torii requests to avoid CORS issues with COEP:

```ts
server: {
  proxy: {
    '/world.World': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
  },
}
```

## 5. ZK npm dependencies

Ensure these are in package.json:

- `@aztec/bb.js` — Barretenberg (Poseidon2, UltraHonk prover)
- `@noir-lang/noir_js` — Noir witness generation
- `garaga` — Garaga calldata formatting for Starknet
- `@dojoengine/torii-client` — Torii WASM client
