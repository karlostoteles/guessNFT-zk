/**
 * Typed access to the Schizodio collection dataset (schizodio.json).
 *
 * Pre-warm with loadCollectionData() during character select so the ~2MB JSON
 * is cached before proof generation needs it.
 */

export interface CollectionCharacter {
  id: number;
  name: string;
  image_url: string;
  bitmap: [string, string, string, string];
  merkle_path: string[];
  merkle_path_is_left: boolean[];
}

export interface CollectionDataset {
  traits_root: string;
  characters: CollectionCharacter[];
}

let cache: CollectionDataset | null = null;

/** Synchronous access to cached data. Returns null if not yet loaded. */
export function getCachedCollectionData(): CollectionDataset | null {
  return cache;
}

export async function loadCollectionData(): Promise<CollectionDataset> {
  if (cache) return cache;
  const res = await fetch('/collections/schizodio.json');
  if (!res.ok) throw new Error(`Failed to load collection: ${res.status}`);
  cache = (await res.json()) as CollectionDataset;
  return cache;
}

export function getCharacterBitmap(
  dataset: CollectionDataset,
  characterId: number,
): [string, string, string, string] {
  const char = dataset.characters[characterId];
  if (!char) throw new RangeError(`Character ${characterId} not found`);
  return char.bitmap as [string, string, string, string];
}

export function getCharacterMerklePath(
  dataset: CollectionDataset,
  characterId: number,
): string[] {
  const c = dataset.characters[characterId];
  if (!c) throw new RangeError(`Character ${characterId} not found`);
  return c.merkle_path;
}
