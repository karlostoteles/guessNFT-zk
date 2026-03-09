// scripts/config.ts
// Single source of truth for collection constants.
// TREE_SIZE must be the next power of 2 >= TOTAL.
// Changing either invalidates the deployed traits_root and the Noir circuit array size.

export const TOTAL = 999;
export const TREE_SIZE = 1024; // depth = Math.log2(TREE_SIZE) = 10
