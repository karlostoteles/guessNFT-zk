export const BOARD = {
  width: 16,    // slightly wider to give tiles room at all counts
  depth: 12,
  height: 0.3,
  tiltAngle: 0.21, // ~12 degrees in radians
  color: '#2d1810',
} as const;

export const TILE = {
  // Legacy constants kept for compatibility; actual sizes computed by computeAdaptiveGrid
  width: 1.4,
  height: 1.8,
  depth: 0.06,
  gap: 0.35,
  cols: 6,
  rows: 4,
} as const;

export const CAMERA = {
  player1: { position: [0, 7, 11] as const, lookAt: [0, 1.5, 0] as const },
  player2: { position: [0, 7, 11] as const, lookAt: [0, 1.5, 0] as const },
  overview: { position: [0, 12, 14] as const, lookAt: [0, 1, 0] as const },
} as const;

// ─── Adaptive grid layout ──────────────────────────────────────────────────────

export interface AdaptiveGridLayout {
  cols: number;
  rows: number;
  tileW: number;  // tile width in world units
  tileH: number;  // tile height in world units
  gap: number;    // gap between tiles
  gridW: number;  // total grid width
  gridD: number;  // total grid depth
}

/**
 * Compute the adaptive grid layout for N active tiles.
 * Uses a 16:10 target aspect ratio so the grid always fits the board.
 */
export function computeAdaptiveGrid(activeCount: number): AdaptiveGridLayout {
  const ASPECT = 1.7;     // cols/rows target ratio (16:10ish)
  const USABLE = 14.0;    // world units of usable board width
  const GAP_FRAC = 0.18;  // gap = GAP_FRAC × tileW
  const MAX_TILE_W = 1.2; // Prevent giant late-game cards when few tiles remain
  const MIN_TILE_W = 0.16;

  const n = Math.max(1, activeCount);
  const cols = Math.ceil(Math.sqrt(n * ASPECT));
  const rows = Math.ceil(n / cols);

  // tileW × (cols + (cols-1) × GAP_FRAC) = USABLE  →  solve for tileW
  const rawTileW = USABLE / (cols + (cols - 1) * GAP_FRAC);
  const tileW = Math.max(MIN_TILE_W, Math.min(MAX_TILE_W, rawTileW));
  const gap = tileW * GAP_FRAC;
  const tileH = tileW * 1.35; // portrait aspect ratio

  const gridW = cols * tileW + (cols - 1) * gap;
  const gridD = rows * tileH + (rows - 1) * gap;

  return { cols, rows, tileW, tileH, gap, gridW, gridD };
}

/**
 * Compute ideal camera position to frame the active tile grid.
 * Camera smoothly zooms in as the grid shrinks.
 */
export function computeAdaptiveCamera(activeCount: number): {
  position: [number, number, number];
  lookAt: [number, number, number];
} {
  const { gridW, gridD } = computeAdaptiveGrid(activeCount);
  const view = Math.max(gridW, gridD * 0.9);
  // Pull back enough to see the whole board; clamp to a comfortable min distance
  const z = Math.max(9, view * 0.88 + 3.5);
  const y = Math.max(6, view * 0.58 + 2.5);
  return {
    position: [0, y, z],
    lookAt: [0, 0, 0],
  };
}

/**
 * LOD tier based on tile world-space width.
 *   flat → canvas portrait texture, click events, no depth
 *   full → 3D card with depth + name label + real NFT images
 */
export type TileLOD = 'flat' | 'full';

export function getTileLOD(tileW: number): TileLOD {
  if (tileW < 1.0) return 'flat';
  return 'full';
}

export const COLORS = {
  player1: { primary: '#E8A444', bg: 'rgba(232, 164, 68, 0.15)' },
  player2: { primary: '#44A8E8', bg: 'rgba(68, 168, 232, 0.15)' },
  background: '#0f0e17',
  surface: 'rgba(255, 255, 255, 0.08)',
  surfaceHover: 'rgba(255, 255, 255, 0.14)',
  text: '#FFFFFE',
  textMuted: 'rgba(255, 255, 254, 0.6)',
  accent: '#E8A444',
  yes: '#4CAF50',
  no: '#E05555',
  // Pastel pop accents — derived from logo palette (gold G, pink N?, purple FT)
  pastelGold: '#F0C97A',
  pastelPink: '#F472B6',
  pastelPurple: '#A78BFA',
  pastelMint: '#6EE7B7',
} as const;
