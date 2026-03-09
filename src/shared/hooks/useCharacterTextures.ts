import { useRef, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useGameCharacters } from '@/core/store/selectors';
import { useGameStore } from '@/core/store/gameStore';
import { renderPortrait, renderCardBack } from '@/rendering/canvas/PortraitRenderer';
import { textureCache } from '@/shared/textureCache';
import { toSafeNftImageUrl } from '@/shared/utils/schizodioImage';

// Match the cap in CharacterGrid — no point creating textures for tiles
// that will never be rendered.
const MAX_TEXTURES = 30;

function toTokenId(charId: string): string {
  return charId.startsWith('nft_') ? charId.slice(4) : charId;
}

function getTextureCandidates(char: { id: string; imageUrl?: string }): string[] {
  const tokenId = toTokenId(char.id);
  const safeUrl = toSafeNftImageUrl(char.imageUrl, tokenId);
  return safeUrl ? [safeUrl] : [];
}

/**
 * Loads textures for characters (procedural first, then async NFT upgrade).
 *
 * For large collections (>MAX_TEXTURES), only creates textures on demand
 * as the grid requests them. Procedural textures are created lazily via
 * getOrCreateTexture() which CharacterTile can call.
 */
export function useCharacterTextures(): { textures: Map<string, THREE.Texture>; ready: boolean } {
  const characters = useGameCharacters() || [];
  const setTextureProgress = useGameStore((s) => s.setTextureProgress);
  const generationRef = useRef(0);
  const [cacheVersion, setCacheVersion] = useState(0);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });

  // Limit: only pre-create procedural textures for up to MAX_TEXTURES characters.
  // For large collections, the grid caps rendering at 30 tiles anyway.
  const charsToLoad = useMemo(
    () => characters.slice(0, MAX_TEXTURES),
    [characters],
  );

  // 1. Build procedural textures synchronously
  useEffect(() => {
    let changed = false;
    for (const char of charsToLoad) {
      if (!textureCache.has(char.id)) {
        const tex = renderPortrait(char, undefined, false);
        tex.userData = { ...(tex.userData || {}), source: 'procedural-fallback' };
        textureCache.set(char.id, tex);
        changed = true;
      }
    }
    if (changed) {
      setCacheVersion((v) => v + 1);
    }
  }, [charsToLoad]);

  // 2. Async upgrade: load missing NFT art from server-safe URLs only.
  useEffect(() => {
    const pendingChars = charsToLoad.filter((char) => {
      const existing = textureCache.get(char.id);
      return !existing || existing.userData?.source === 'procedural-fallback';
    });

    const total = pendingChars.length;
    const initial = { loaded: 0, total };
    setProgress(initial);
    setTextureProgress(initial);

    if (total === 0) return;

    const generation = ++generationRef.current;
    let cancelled = false;
    const loader = new THREE.TextureLoader();

    const report = (loaded: number) => {
      const next = { loaded, total };
      setProgress(next);
      setTextureProgress(next);
    };

    const loadAll = async () => {
      let loaded = 0;

      for (const char of pendingChars) {
        if (cancelled || generation !== generationRef.current) break;

        let loadedTexture: THREE.Texture | null = null;
        const candidates = getTextureCandidates(char as { id: string; imageUrl?: string });

        for (const url of candidates) {
          try {
            loadedTexture = await loader.loadAsync(url);
            break;
          } catch {
            // Try next candidate URL.
          }
        }

        if (loadedTexture) {
          if (cancelled || generation !== generationRef.current) {
            loadedTexture.dispose();
            continue;
          }

          loadedTexture.colorSpace = THREE.SRGBColorSpace;
          loadedTexture.minFilter = THREE.LinearFilter;
          loadedTexture.generateMipmaps = false;
          loadedTexture.userData = { source: 'remote-nft' };

          const old = textureCache.get(char.id);
          if (old && old.userData?.source === 'procedural-fallback') {
            old.dispose();
          }

          textureCache.set(char.id, loadedTexture);
          setCacheVersion((v) => v + 1);
        }

        loaded += 1;
        report(loaded);
      }
    };

    void loadAll();
    return () => { cancelled = true; };
  }, [charsToLoad, setTextureProgress]);

  // Build a reactive snapshot of the cache for consumers.
  const textures = useMemo(() => {
    return new Map(textureCache);
  }, [cacheVersion]);

  const ready = progress.total === 0 || progress.loaded >= progress.total;
  return { textures, ready };
}

/**
 * Create a procedural texture on demand for characters not in the pre-loaded set.
 * Called by CharacterGrid when it renders a character beyond the initial batch.
 */
export function getOrCreateTexture(
  charId: string,
  character: { id: string; name: string; traits: Record<string, unknown> },
): THREE.Texture {
  const cached = textureCache.get(charId);
  if (cached) return cached;
  const tex = renderPortrait(character as any, undefined, false);
  tex.userData = { source: 'procedural-fallback' };
  textureCache.set(charId, tex);
  return tex;
}

export function useCardBackTexture(): THREE.CanvasTexture {
  const texture = useMemo(() => renderCardBack(), []);

  useEffect(() => {
    return () => { texture.dispose(); };
  }, [texture]);

  return texture;
}

export { textureCache as globalTextureCache } from '@/shared/textureCache';
