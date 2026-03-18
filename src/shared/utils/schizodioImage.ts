/**
 * Helpers to keep SCHIZODIO art same-origin under COEP.
 * Direct v1assets URLs are blocked in cross-origin isolated contexts.
 */

const SCHIZODIO_REVEALED_PATTERN =
  /v1assets\.schizod\.io\/images\/revealed\/([a-f0-9]+)\.png(?:\?.*)?$/i;

export function extractSchizodioImageHash(url: string): string | null {
  const match = url.match(SCHIZODIO_REVEALED_PATTERN);
  return match ? match[1] : null;
}

export function toSafeNftImageUrl(
  imageUrl: string | null | undefined,
  tokenId?: string | number,
): string {
  if (!imageUrl) {
    // Path-based proxy for Netlify: /nft-meta/:id.json provides metadata,
    // but we need the image directly. Use the hash-based path if possible.
    return '';
  }

  // Already safe/local.
  if (
    imageUrl.startsWith('/nft-img/') ||
    imageUrl.startsWith('/api/') ||
    imageUrl.startsWith('/nft/') ||
    imageUrl.startsWith('data:') ||
    imageUrl.startsWith('blob:')
  ) {
    return imageUrl;
  }

  // Extract hash and use path-based proxy (works on both Vercel and Netlify).
  const hash = extractSchizodioImageHash(imageUrl);
  if (hash) return `/nft-img/${hash}.png`;

  // Fallback for v1assets URLs that don't match the canonical hash path.
  if (/v1assets\.schizod\.io/i.test(imageUrl) && tokenId != null) {
    return `/nft-img/${tokenId}.png`;
  }

  return imageUrl;
}
