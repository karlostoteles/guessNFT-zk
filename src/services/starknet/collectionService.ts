/**
 * Generates the full 999-token SCHIZODIO collection as game characters.
 *
 * Strategy:
 * - Characters are created with deterministic traits derived from token ID (no API calls).
 * - Real artwork loads lazily via the serverless proxy once tiles are large enough to see.
 * - Result is module-level memoized — only computed once per session.
 */

import type { Character } from '@/core/data/characters';
import { buildTraitsFromBitmap, deriveFreeTraits, hashString } from '@/core/data/nftCharacterAdapter';
import schizodioData from '@/core/data/schizodio.json';
import { toSafeNftImageUrl } from '@/shared/utils/schizodioImage';

export const COLLECTION_SIZE = 999;
export const PLAYABLE_COLLECTION_SIZE = 30;

let _cached: Character[] | null = null;
const _playableCache = new Map<string, Character[]>();

export async function generateAllCollectionCharacters(): Promise<Character[]> {
  if (_cached) return _cached;

  const { characters, question_schema } = schizodioData;
  const chars: Character[] = [];

  for (const raw of characters) {
    const seed = hashString(String(raw.id));

    // 1. Parse real NFT traits from bitmap
    const nftTraits = buildTraitsFromBitmap(raw.bitmap, question_schema);

    // 2. Derive free-mode traits (web2 fallbacks)
    const traits = deriveFreeTraits(nftTraits, seed);

    chars.push({
      id: `nft_${raw.id}`,
      name: raw.name || `Schizodio #${raw.id}`,
      imageUrl: toSafeNftImageUrl(raw.image_url, raw.id),
      traits,
    });
  }

  _cached = chars;
  return chars;
}

function parseTokenId(char: Character): number {
  const numeric = Number.parseInt(char.id.replace('nft_', ''), 10);
  return Number.isFinite(numeric) ? numeric : 0;
}

function pickDeterministicSubset(
  all: Character[],
  seed: string,
  size: number,
): Character[] {
  if (all.length <= size) return [...all];

  const shuffled = [...all];
  let state = hashString(seed || 'default-seed') >>> 0;

  // Deterministic in-place Fisher-Yates using an LCG.
  for (let i = shuffled.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled
    .slice(0, size)
    .sort((a, b) => parseTokenId(a) - parseTokenId(b));
}

/**
 * Returns a deterministic playable subset for a match.
 * Use the same seed (e.g. gameId) on both clients to guarantee identical pools.
 */
export async function generatePlayableCollectionCharacters(
  seed: string,
  size: number = PLAYABLE_COLLECTION_SIZE,
): Promise<Character[]> {
  const key = `${seed}:${size}`;
  const cached = _playableCache.get(key);
  if (cached) return cached;

  const all = await generateAllCollectionCharacters();
  const playable = pickDeterministicSubset(all, seed, size);
  _playableCache.set(key, playable);
  return playable;
}

/** Clear the cache (useful for hot-reload during development) */
export function clearCollectionCache(): void {
  _cached = null;
  _playableCache.clear();
}
