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
    return tokenId != null ? `/api/nft-art?id=${tokenId}` : '';
  }

  // Already safe/local.
  if (
    imageUrl.startsWith('/api/') ||
    imageUrl.startsWith('/nft/') ||
    imageUrl.startsWith('data:') ||
    imageUrl.startsWith('blob:')
  ) {
    return imageUrl;
  }

  const hash = extractSchizodioImageHash(imageUrl);
  if (hash) return `/api/nft-img?hash=${hash}`;

  // Fallback for v1assets URLs that don't match the canonical hash path.
  if (/v1assets\.schizod\.io/i.test(imageUrl) && tokenId != null) {
    return `/api/nft-art?id=${tokenId}`;
  }

  return imageUrl;
}
