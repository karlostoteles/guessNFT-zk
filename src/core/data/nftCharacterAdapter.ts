/**
 * Maps SCHIZODIO NFTs to the game's Character interface.
 *
 * SCHIZODIO trait_type names (verified from schizodio.art, March 2026):
 *   Accessories, Background, Body, Clothing, Eyebrows, Eyes, Eyewear,
 *   Hair, Headwear, Mask, Mouth, Overlays, Sidekick, Weapons
 *
 * "Absent" trait pattern: value starts with "No " (e.g. "No Mask", "No Weapons")
 * All nft_* string fields are stored LOWERCASED so matchFn keywords match directly.
 *
 * Strategy:
 *   - If NFT metadata has real attributes → populate all nft_* fields from them.
 *   - If attributes are empty (stubs / proxy miss) → hash tokenId for free-mode
 *     traits and leave nft_* fields undefined (NFT questions won't fire).
 *   - enrichCharacters() batch-applies real attributes to existing Character objects
 *     and is called after trait-fetch completes, before the game begins.
 */
import type { Character } from './characters';
import type { CharacterTraits, HairColor, HairStyle, SkinTone, EyeColor, Gender } from './traits';
import type { SchizodioNFT, NFTAttribute } from '@/services/starknet/types';
import { toSafeNftImageUrl } from '@/shared/utils/schizodioImage';

// Game character with source tracking
export interface NFTCharacter extends Character {
  source: 'nft';
  imageUrl: string;
  tokenId: string;
}

export interface MockCharacter extends Character {
  source: 'mock';
}

export type GameCharacter = NFTCharacter | MockCharacter;

// ─── Deterministic fallback arrays ────────────────────────────────────────────

const HAIR_COLORS: HairColor[] = ['black', 'brown', 'blonde', 'red', 'white', 'blue'];
const HAIR_STYLES: HairStyle[] = ['short', 'long', 'curly', 'bald', 'mohawk', 'ponytail'];
const SKIN_TONES: SkinTone[] = ['light', 'medium', 'tan', 'dark', 'very_dark'];
const EYE_COLORS: EyeColor[] = ['brown', 'blue', 'green', 'hazel'];
const GENDERS: Gender[] = ['male', 'female'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Deterministic hash from a string → positive integer */
export function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickFromArray<T>(arr: T[], seed: number, offset: number): T {
  return arr[(seed + offset * 7) % arr.length];
}

/**
 * Find a trait value by trying multiple possible trait_type names (case-insensitive).
 * Returns the value as-is (not lowercased) since callers may need the original.
 */
function findAttribute(attrs: NFTAttribute[], ...names: string[]): string | undefined {
  for (const name of names) {
    const found = attrs.find((a) => a.trait_type.toLowerCase() === name.toLowerCase());
    if (found) return found.value;
  }
  return undefined;
}

/** True if a trait value represents "absent" (starts with "No " or is exactly "none") */
function isAbsent(value: string | undefined): boolean {
  if (!value) return true;
  const lower = value.toLowerCase().trim();
  return lower === 'none' || lower.startsWith('no ');
}

function mapToEnum<T extends string>(
  attrValue: string | undefined,
  options: T[],
  seed: number,
  offset: number,
): T {
  if (!attrValue) return pickFromArray(options, seed, offset);
  const lower = attrValue.toLowerCase().replace(/[-_\s]/g, '');
  const exact = options.find((o) => o.toLowerCase().replace(/[-_\s]/g, '') === lower);
  if (exact !== undefined) return exact;
  const partial = options.find((o) => lower.includes(o.toLowerCase()) || o.toLowerCase().includes(lower));
  if (partial !== undefined) return partial;
  return pickFromArray(options, seed, offset);
}

function deriveBool(attrValue: string | undefined, seed: number, offset: number): boolean {
  if (!attrValue) return (seed + offset * 13) % 3 === 0;
  return !isAbsent(attrValue);
}

// ─── NFT trait mapping ────────────────────────────────────────────────────────

/**
 * SCHIZODIO trait bitmask parser.
 * Schema maps index -> trait name (e.g. 104 -> "body_snowflake")
 */
export function buildTraitsFromBitmap(
  bitmap: string[],
  schema: Record<string, string>
): Partial<CharacterTraits> {
  const traits: Partial<CharacterTraits> = {};

  // Helper to check if a specific bit is set in the bitmap
  const hasBit = (idx: number) => {
    const chunkIdx = Math.floor(idx / 128);
    const bitOffset = idx % 128;
    const chunk = bitmap[chunkIdx];
    if (!chunk) return false;
    try {
      const val = BigInt(chunk);
      return (val & (1n << BigInt(bitOffset))) !== 0n;
    } catch { return false; }
  };

  // Iterate over all schema entries (indices 0 to 417 confirmed in schizodio.json)
  for (const [key, traitName] of Object.entries(schema)) {
    const idx = parseInt(key, 10);
    if (isNaN(idx)) continue;
    if (!hasBit(idx)) continue;

    const lowerName = traitName.toLowerCase();

    // Categorize and map to nft_* fields
    if (lowerName.startsWith('hair_')) traits.nft_hair = lowerName.replace('hair_', '');
    else if (lowerName.startsWith('eyes_')) traits.nft_eyes = lowerName.replace('eyes_', '');
    else if (lowerName.startsWith('mouth_')) traits.nft_mouth = lowerName.replace('mouth_', '');
    else if (lowerName.startsWith('eyebrows_')) traits.nft_eyebrows = lowerName.replace('eyebrows_', '');
    else if (lowerName.startsWith('body_')) traits.nft_body = lowerName.replace('body_', '');
    else if (lowerName.startsWith('clothing_')) traits.nft_clothing = lowerName.replace('clothing_', '');
    else if (lowerName.startsWith('sidekick_')) {
      traits.nft_sidekick = lowerName.replace('sidekick_', '');
      traits.nft_has_sidekick = true;
    }
    else if (lowerName.startsWith('background_')) traits.nft_background = lowerName.replace('background_', '');
    else if (lowerName.startsWith('mask_')) traits.nft_has_mask = true;
    else if (lowerName.startsWith('weapons_')) traits.nft_has_weapons = true;
    else if (lowerName.startsWith('eyewear_')) traits.nft_has_eyewear = true;
    else if (lowerName.startsWith('headwear_')) traits.nft_has_headwear = true;
    else if (lowerName.startsWith('accessories_')) traits.nft_has_accessories = true;
    else if (lowerName.startsWith('overlays_')) traits.nft_has_overlay = true;
  }

  return traits;
}

/**
 * Build web2 fallbacks (hair_color, etc.) from real NFT traits.
 * This ensures the "Free Mode" questions also work correctly on NFT characters.
 */
export function deriveFreeTraits(nftTraits: Partial<CharacterTraits>, seed: number): CharacterTraits {
  const hair = nftTraits.nft_hair || '';
  const eyes = nftTraits.nft_eyes || '';
  const body = nftTraits.nft_body || '';

  return {
    hair_color: mapToEnum(hair, HAIR_COLORS, seed, 0),
    hair_style: mapToEnum(hair, HAIR_STYLES, seed, 1),
    skin_tone: mapToEnum(body, SKIN_TONES, seed, 2),
    gender: mapToEnum(undefined, GENDERS, seed, 3),
    eye_color: mapToEnum(eyes, EYE_COLORS, seed, 4),
    has_glasses: nftTraits.nft_has_eyewear || deriveBool(undefined, seed, 5),
    has_hat: nftTraits.nft_has_headwear || deriveBool(undefined, seed, 6),
    has_beard: deriveBool(undefined, seed, 7),
    has_earrings: nftTraits.nft_has_accessories || deriveBool(undefined, seed, 8),
    ...nftTraits,
  };
}

/**
 * Build the nft_* fields from a real attribute array (used for user's owned NFTs).
 */
function buildNftTraits(attrs: NFTAttribute[]): Partial<CharacterTraits> {
  if (attrs.length === 0) return {};

  const raw = {
    hair: findAttribute(attrs, 'Hair'),
    eyes: findAttribute(attrs, 'Eyes'),
    mouth: findAttribute(attrs, 'Mouth'),
    eyebrows: findAttribute(attrs, 'Eyebrows'),
    body: findAttribute(attrs, 'Body'),
    clothing: findAttribute(attrs, 'Clothing'),
    mask: findAttribute(attrs, 'Mask'),
    weapons: findAttribute(attrs, 'Weapons'),
    eyewear: findAttribute(attrs, 'Eyewear'),
    headwear: findAttribute(attrs, 'Headwear'),
    accessories: findAttribute(attrs, 'Accessories'),
    overlays: findAttribute(attrs, 'Overlays'),
    sidekick: findAttribute(attrs, 'Sidekick'),
    background: findAttribute(attrs, 'Background'),
  };

  // Log in dev for debugging
  if (import.meta.env.DEV) {
  }

  return {
    // String traits — stored lowercase so matchFn includes() works directly
    nft_hair: raw.hair ? raw.hair.toLowerCase() : undefined,
    nft_eyes: raw.eyes ? raw.eyes.toLowerCase() : undefined,
    nft_mouth: raw.mouth ? raw.mouth.toLowerCase() : undefined,
    nft_eyebrows: raw.eyebrows ? raw.eyebrows.toLowerCase() : undefined,
    nft_body: raw.body ? raw.body.toLowerCase() : undefined,
    nft_clothing: raw.clothing ? raw.clothing.toLowerCase() : undefined,
    nft_sidekick: raw.sidekick ? raw.sidekick.toLowerCase() : undefined,
    nft_background: raw.background ? raw.background.toLowerCase() : undefined,

    // Boolean traits — true only when a real (non-"No X") value exists
    nft_has_mask: !isAbsent(raw.mask),
    nft_has_weapons: !isAbsent(raw.weapons),
    nft_has_eyewear: !isAbsent(raw.eyewear),
    nft_has_headwear: !isAbsent(raw.headwear),
    nft_has_accessories: !isAbsent(raw.accessories),
    nft_has_overlay: !isAbsent(raw.overlays),
    nft_has_sidekick: !isAbsent(raw.sidekick),
  };
}

// ─── Main converter ───────────────────────────────────────────────────────────

/**
 * Convert a SCHIZODIO NFT to a game Character.
 * Free-mode traits are always populated (deterministic hash fallback if no attrs).
 * NFT-specific traits (nft_*) are populated only when real attributes are present.
 */
export function nftToCharacter(nft: SchizodioNFT): NFTCharacter {
  const seed = hashString(nft.tokenId);
  const attrs = nft.attributes ?? [];

  if (import.meta.env.DEV && attrs.length > 0) {
    // Intentionally left empty
  }

  // ── Free-mode traits (always present) ──────────────────────────────────────
  // These map to FREE_QUESTIONS and the classic game. Use the SCHIZODIO attributes
  // when available, fall back to deterministic hash when not.
  const hair = findAttribute(attrs, 'Hair');
  const eyes = findAttribute(attrs, 'Eyes');
  const body = findAttribute(attrs, 'Body');
  const head = findAttribute(attrs, 'Headwear', 'Mask');
  const accs = findAttribute(attrs, 'Accessories', 'Eyewear');

  const freeTraits: CharacterTraits = {
    hair_color: mapToEnum(hair, HAIR_COLORS, seed, 0),
    hair_style: mapToEnum(hair, HAIR_STYLES, seed, 1),
    skin_tone: mapToEnum(body, SKIN_TONES, seed, 2),
    gender: mapToEnum(undefined, GENDERS, seed, 3),   // not in SCHIZODIO attrs
    eye_color: mapToEnum(eyes, EYE_COLORS, seed, 4),
    has_glasses: deriveBool(findAttribute(attrs, 'Eyewear'), seed, 5),
    has_hat: deriveBool(head, seed, 6),
    has_beard: deriveBool(undefined, seed, 7),            // not in SCHIZODIO attrs
    has_earrings: deriveBool(accs, seed, 8),

    // ── NFT-specific traits ─────────────────────────────────────────────────
    ...buildNftTraits(attrs),
  };

  return {
    id: `nft_${nft.tokenId}`,
    name: nft.name || `#${nft.tokenId}`,
    traits: freeTraits,
    source: 'nft',
    imageUrl: toSafeNftImageUrl(nft.imageUrl, nft.tokenId),
    tokenId: nft.tokenId,
  };
}

// ─── Enrichment (post-fetch update) ──────────────────────────────────────────

/**
 * Apply real attributes to existing Character objects in-place.
 * Called after `fetchTraitsBatch()` completes, before the game starts.
 * Mutates the traits object directly since these are module-level memoized objects.
 *
 * @param characters - The 24 game characters (already in store)
 * @param traitMap   - Map of tokenId → attributes from fetchTraitsBatch()
 * @returns count of characters that were successfully enriched
 */
export function enrichCharacters(
  characters: Character[],
  traitMap: Map<string, NFTAttribute[]>,
): number {
  let enriched = 0;
  for (const char of characters) {
    const nftChar = char as NFTCharacter;
    if (nftChar.source !== 'nft' || !nftChar.tokenId) continue;

    const attrs = traitMap.get(nftChar.tokenId);
    if (!attrs || attrs.length === 0) continue;

    const nftTraits = buildNftTraits(attrs);
    Object.assign(char.traits, nftTraits);
    enriched++;
  }
  return enriched;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Wrap a mock character with source tracking. */
export function toMockCharacter(char: Character): MockCharacter {
  return { ...char, source: 'mock' };
}

/**
 * Select 24 game characters from owned NFTs.
 * Pads with mock characters if fewer than 24 NFTs.
 */
export function selectGameCharacters(
  nfts: SchizodioNFT[],
  mockCharacters: Character[],
): GameCharacter[] {
  const nftCharacters = nfts.map(nftToCharacter);

  if (nftCharacters.length >= 24) {
    const shuffled = [...nftCharacters].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 24);
  }

  const needed = 24 - nftCharacters.length;
  const padding = mockCharacters.slice(0, needed).map(toMockCharacter);
  return [...nftCharacters, ...padding];
}
