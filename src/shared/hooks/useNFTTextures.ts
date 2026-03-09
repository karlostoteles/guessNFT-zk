import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { useGameCharacters, useGameMode } from '@/core/store/selectors';
import type { NFTCharacter } from '@/core/data/nftCharacterAdapter';
import { toSafeNftImageUrl } from '@/shared/utils/schizodioImage';

/**
 * Loads NFT images as Three.js textures.
 * Only active in NFT mode. Falls back gracefully if image fails to load.
 * Returns a Map<characterId, CanvasTexture> for NFT characters with loaded images.
 */
export function useNFTTextures(): Map<string, THREE.Texture> {
  const characters = useGameCharacters();
  const mode = useGameMode();
  const [textures, setTextures] = useState<Map<string, THREE.Texture>>(new Map());

  useEffect(() => {
    if (mode !== 'nft') {
      setTextures(new Map());
      return;
    }

    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    const loaded = new Map<string, THREE.Texture>();
    let cancelled = false;

    const nftChars = characters.filter(
      (c): c is NFTCharacter => 'source' in c && (c as any).source === 'nft'
    );

    if (nftChars.length === 0) {
      setTextures(new Map());
      return;
    }

    // Load all NFT images concurrently
    const promises = nftChars.map(
      (char) =>
        new Promise<void>((resolve) => {
          // Convert IPFS URLs to gateway
          let url = toSafeNftImageUrl(
            char.imageUrl,
            (char as any).tokenId ?? char.id.replace('nft_', ''),
          );
          if (url.startsWith('ipfs://')) {
            url = url.replace('ipfs://', 'https://ipfs.io/ipfs/');
          }

          loader.load(
            url,
            (texture) => {
              if (!cancelled) {
                texture.colorSpace = THREE.SRGBColorSpace;
                loaded.set(char.id, texture);
              }
              resolve();
            },
            undefined,
            () => {
              // Failed to load — will fall back to procedural portrait
              console.warn(`[nft-textures] Failed to load image for ${char.name} (${char.id})`);
              resolve();
            }
          );
        })
    );

    Promise.all(promises).then(() => {
      if (!cancelled) {
        setTextures(new Map(loaded));
      }
    });

    return () => {
      cancelled = true;
      // Dispose textures on cleanup
      loaded.forEach((tex) => tex.dispose());
    };
  }, [characters, mode]);

  return textures;
}
