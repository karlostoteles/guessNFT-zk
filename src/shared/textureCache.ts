import * as THREE from 'three';

export const textureCache = new Map<string, THREE.Texture>();

export function clearTextureCache() {
  textureCache.forEach(tex => tex.dispose());
  textureCache.clear();
}
