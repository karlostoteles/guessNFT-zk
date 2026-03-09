/**
 * NFT ownership querying for SCHIZODIO collection.
 * Uses raw starknet.js RPC calls to read ERC-721 contract state.
 */
import {
  RpcProvider,
  Contract,
  uint256,
  byteArray as byteArrayUtils,
  shortString,
  type Abi,
  type ArgsOrCalldata,
} from 'starknet';
import { SCHIZODIO_CONTRACT, RPC_URL } from './config';
import type { SchizodioNFT, NFTAttribute } from './types';
import { toSafeNftImageUrl } from '@/shared/utils/schizodioImage';

// ── IPFS gateways — tried in order until one responds ─────────────────────────
// cloudflare-ipfs.com was deprecated/shut down in 2024, do NOT use it.
export const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://nftstorage.link/ipfs/',
];

// Minimal ERC-721 ABI for read operations (both camelCase and snake_case)
const ERC721_ABI: Abi = [
  {
    name: 'balance_of',
    type: 'function',
    inputs: [{ name: 'owner', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'token_of_owner_by_index',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'index', type: 'core::integer::u256' },
    ],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'token_uri',
    type: 'function',
    inputs: [{ name: 'token_id', type: 'core::integer::u256' }],
    outputs: [{ type: 'core::byte_array::ByteArray' }],
    state_mutability: 'view',
  },
  // camelCase variants
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'owner', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'tokenOfOwnerByIndex',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'index', type: 'core::integer::u256' },
    ],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'tokenURI',
    type: 'function',
    inputs: [{ name: 'token_id', type: 'core::integer::u256' }],
    outputs: [{ type: 'core::byte_array::ByteArray' }],
    state_mutability: 'view',
  },
] as unknown as Abi;

function getProvider() {
  return new RpcProvider({ nodeUrl: RPC_URL });
}

function getContract() {
  return new Contract({
    abi: ERC721_ABI,
    address: SCHIZODIO_CONTRACT,
    providerOrAccount: getProvider(),
  });
}

/**
 * Decode a raw starknet.js call result to a string.
 *
 * Starknet contracts can return URIs in several formats:
 *   1. Already a JS string (starknet.js auto-decoded ByteArray)
 *   2. BigInt / felt252 (short string ≤31 chars)
 *   3. ByteArray object {data, pending_word, pending_word_len}
 *   4. Array of felt252s (concatenated short strings)
 */
function decodeStarknetString(raw: any): string {
  if (typeof raw === 'string') {
    // Could be hex-encoded felt — try decoding if it looks like one
    if (/^0x[0-9a-fA-F]+$/.test(raw) && !raw.includes('://') && !raw.startsWith('data:')) {
      try {
        const decoded = shortString.decodeShortString(raw);
        if (decoded.includes('://') || decoded.startsWith('data:') || decoded.startsWith('ipfs')) {
          return decoded;
        }
      } catch { /* not a short string — keep as-is */ }
    }
    return raw;
  }

  if (typeof raw === 'bigint') {
    try {
      return shortString.decodeShortString('0x' + raw.toString(16));
    } catch {
      return raw.toString();
    }
  }

  // ByteArray {data: bigint[], pending_word: bigint, pending_word_len: number}
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if ('data' in raw || 'pending_word' in raw) {
      try {
        return byteArrayUtils.stringFromByteArray(raw as any);
      } catch {
        /* fall through */
      }
    }
    // Might be a single-key object wrapping the value
    const keys = Object.keys(raw);
    if (keys.length === 1) return decodeStarknetString(raw[keys[0]]);
  }

  // Array of felts — concatenate decoded short strings
  if (Array.isArray(raw) && raw.length > 0) {
    try {
      return raw.map((f: any) => {
        try {
          return shortString.decodeShortString(typeof f === 'bigint' ? '0x' + f.toString(16) : String(f));
        } catch {
          return '';
        }
      }).join('');
    } catch { /* fall through */ }
  }

  const s = String(raw);
  return s === '[object Object]' ? '' : s;
}

/**
 * Resolve IPFS and HTTP URIs to usable HTTP URLs.
 * gatewayIndex lets callers retry with the next gateway on failure.
 */
export function resolveUrl(url: string, gatewayIndex = 0): string {
  if (!url) return '';
  if (url.startsWith('ipfs://')) {
    const gateway = IPFS_GATEWAYS[gatewayIndex % IPFS_GATEWAYS.length];
    return url.replace('ipfs://', gateway);
  }
  // Already HTTP/HTTPS or data URI
  return url;
}

/**
 * Fetch a URL trying all IPFS gateways until one succeeds.
 * Only applies the gateway rotation if the URL contains an IPFS path.
 */
async function fetchWithGatewayFallback(url: string): Promise<Response> {
  // For non-IPFS URLs, just fetch directly
  if (!url.startsWith('ipfs://') && !IPFS_GATEWAYS.some((g) => url.startsWith(g))) {
    return fetch(url);
  }

  // Extract the raw IPFS path (cid/path)
  let ipfsPath = url;
  if (url.startsWith('ipfs://')) {
    ipfsPath = url.slice('ipfs://'.length);
  } else {
    for (const g of IPFS_GATEWAYS) {
      if (url.startsWith(g)) { ipfsPath = url.slice(g.length); break; }
    }
  }

  let lastErr: unknown;
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const resp = await fetch(gateway + ipfsPath);
      if (resp.ok) return resp;
      lastErr = new Error(`HTTP ${resp.status}`);
    } catch (err) {
      lastErr = err;
    }
    console.warn(`[nftService] gateway ${gateway} failed, trying next…`);
  }
  throw lastErr;
}

/**
 * Try calling a contract function, attempting snake_case then camelCase.
 */
async function tryCall(
  contract: Contract,
  snakeName: string,
  camelName: string,
  args: ArgsOrCalldata,
): Promise<any> {
  try {
    return await contract.call(snakeName, args);
  } catch {
    return await contract.call(camelName, args);
  }
}

/**
 * Fetch all token IDs owned by an address.
 */
export async function fetchOwnedTokenIds(ownerAddress: string): Promise<string[]> {
  const contract = getContract();

  const balanceResult = await tryCall(contract, 'balance_of', 'balanceOf', [ownerAddress]);
  const balance = Number(BigInt(balanceResult.toString()));

  if (balance === 0) return [];

  const tokenIds: string[] = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < balance; i += BATCH_SIZE) {
    const batch = Array.from(
      { length: Math.min(BATCH_SIZE, balance - i) },
      (_, j) => i + j,
    );

    const results = await Promise.all(
      batch.map(async (index) => {
        try {
          const result = await tryCall(
            contract,
            'token_of_owner_by_index',
            'tokenOfOwnerByIndex',
            [ownerAddress, uint256.bnToUint256(BigInt(index))],
          );
          return result.toString();
        } catch (err) {
          console.warn(`[nftService] Failed to fetch token at index ${index}:`, err);
          return null;
        }
      }),
    );

    tokenIds.push(...results.filter((id): id is string => id !== null));
  }

  return tokenIds;
}

/**
 * Parse metadata JSON — handles both plain JSON and
 * base64-encoded data URIs (on-chain NFTs).
 */
function parseMetadata(raw: string): any {
  // data:application/json;base64,...
  if (raw.startsWith('data:')) {
    const base64Part = raw.split(',')[1];
    if (base64Part) {
      try {
        return JSON.parse(atob(base64Part));
      } catch { /* fall through */ }
    }
  }
  // data:application/json,...  (URI-encoded)
  if (raw.startsWith('data:') && raw.includes(',')) {
    try {
      return JSON.parse(decodeURIComponent(raw.split(',')[1]));
    } catch { /* fall through */ }
  }
  return JSON.parse(raw);
}

/**
 * Serverless proxy endpoints (Netlify / Vercel) that scrape schizodio.art
 * server-side and return the image URL without CORS issues.
 *
 * The on-chain tokenURI points to techshaman.42024769.xyz which is currently
 * down (broken SSL + backend offline).  The proxy is our primary image source.
 */
const PROXY_ENDPOINTS = [
  '/.netlify/functions/schizodio-meta',
  '/api/schizodio-meta',
];

async function fetchViaProxy(tokenId: string): Promise<{
  imageUrl: string;
  name: string;
  attributes: NFTAttribute[];
} | null> {
  for (const endpoint of PROXY_ENDPOINTS) {
    try {
      const resp = await fetch(`${endpoint}?id=${tokenId}`);
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data.imageUrl) {
        return {
          imageUrl: toSafeNftImageUrl(data.imageUrl, tokenId),
          name: data.name,
          attributes: data.attributes ?? [],
        };
      }
    } catch { /* try next endpoint */ }
  }
  return null;
}

/**
 * Fetch metadata for a single token.
 * Strategy:
 *   1. Try the serverless proxy (schizodio.art scraper — reliable, no CORS).
 *   2. Fall back to on-chain tokenURI → metadata fetch (works if server is up).
 */
export async function fetchTokenMetadata(tokenId: string): Promise<{
  name: string;
  imageUrl: string;
  attributes: NFTAttribute[];
}> {
  // ── 1. Try proxy first (schizodio.art, server-side) ──────────────────────
  const proxyResult = await fetchViaProxy(tokenId);
  if (proxyResult) {
    return proxyResult; // already includes attributes (may be [] if proxy couldn't parse)
  }

  // ── 2. Fall back to on-chain tokenURI → external metadata server ─────────
  const contract = getContract();

  let rawUriResult: any;
  try {
    rawUriResult = await tryCall(
      contract,
      'token_uri',
      'tokenURI',
      [uint256.bnToUint256(BigInt(tokenId))],
    );
  } catch (err) {
    console.warn(`[nftService] tokenURI RPC failed for #${tokenId}:`, err);
    return { name: `SCHIZODIO #${tokenId}`, imageUrl: '', attributes: [] };
  }

  const uri = decodeStarknetString(rawUriResult);

  if (!uri) {
    return { name: `SCHIZODIO #${tokenId}`, imageUrl: '', attributes: [] };
  }

  // On-chain data URI (base64 encoded JSON)
  if (uri.startsWith('data:')) {
    try {
      const metadata = parseMetadata(uri);
      const imageUrl = resolveUrl(metadata.image || metadata.image_url || metadata.image_data || '');
      return {
        name: metadata.name || `SCHIZODIO #${tokenId}`,
        imageUrl: toSafeNftImageUrl(imageUrl, tokenId),
        attributes: metadata.attributes || [],
      };
    } catch (err) {
      console.warn(`[nftService] on-chain metadata parse failed for #${tokenId}:`, err);
      return { name: `SCHIZODIO #${tokenId}`, imageUrl: '', attributes: [] };
    }
  }

  // External HTTP metadata URI
  try {
    const response = await fetchWithGatewayFallback(uri);
    const metadata = parseMetadata(await response.text());
    const rawImage = metadata.image || metadata.image_url || metadata.image_data || metadata.animation_url || '';
    const imageUrl = rawImage.startsWith('ipfs://')
      ? resolveUrl(rawImage, 0)
      : resolveUrl(rawImage);
    return {
      name: metadata.name || `SCHIZODIO #${tokenId}`,
      imageUrl: toSafeNftImageUrl(imageUrl, tokenId),
      rawImageIpfs: rawImage.startsWith('ipfs://') ? rawImage : undefined,
      attributes: metadata.attributes || [],
    } as any;
  } catch (err) {
    console.warn(`[nftService] metadata fetch failed for #${tokenId}:`, err);
    return { name: `SCHIZODIO #${tokenId}`, imageUrl: '', attributes: [] };
  }
}

/**
 * Fetch trait attributes for a list of token IDs in parallel batches.
 * Used to enrich stub characters with real traits before gameplay begins.
 * Returns a map of tokenId → attributes array.
 */
export async function fetchTraitsBatch(
  tokenIds: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, NFTAttribute[]>> {
  const result = new Map<string, NFTAttribute[]>();
  const BATCH_SIZE = 6;

  for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
    const batch = tokenIds.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (tokenId) => {
        try {
          const meta = await fetchTokenMetadata(tokenId);
          result.set(tokenId, meta.attributes);
        } catch {
          result.set(tokenId, []);
        }
      }),
    );
    onProgress?.(Math.min(i + BATCH_SIZE, tokenIds.length), tokenIds.length);
  }

  return result;
}

/**
 * Fetch all owned NFTs with metadata.
 */
export async function fetchAllOwnedNFTs(ownerAddress: string): Promise<SchizodioNFT[]> {
  const tokenIds = await fetchOwnedTokenIds(ownerAddress);

  const nfts: SchizodioNFT[] = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
    const batch = tokenIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (tokenId) => {
        const meta = await fetchTokenMetadata(tokenId);
        return { tokenId, ...meta };
      }),
    );
    nfts.push(...results);
  }

  return nfts;
}
