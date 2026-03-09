// Stub for pino — @aztec/bb.js imports pino for optional logging.
// Vite can't resolve pino's CJS browser entry as ESM when bb.js is
// excluded from optimizeDeps (required for WASM). This no-op stub
// satisfies the import without pulling in the real pino.
const noop = () => {};
const noopLogger = {
  info: noop, debug: noop, warn: noop, error: noop, fatal: noop, trace: noop,
  child: () => noopLogger, level: 'silent',
};
export const pino = () => noopLogger;
export default pino;
