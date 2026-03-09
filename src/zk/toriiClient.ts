/**
 * Torii WASM client — singleton instance for real-time Dojo entity sync.
 *
 * Replaces Supabase realtime. Uses @dojoengine/torii-client (WASM) directly
 * to subscribe to on-chain Game/Commitment/Board/Turn model updates.
 */
import { ToriiClient, type ClientConfig, type Subscription } from '@dojoengine/torii-client';
import { KATANA_RPC } from './config';

// World address from manifest_dev.json (Katana local dev)
export const WORLD_ADDRESS =
  import.meta.env.VITE_WORLD_ADDRESS ?? '0x4f057e1fead04aae0e8d385d109b3cd66dbe472216035698c23764d3330a61d';

// Torii indexer URL — in dev, use same-origin (Vite proxies /world.World/* to Torii).
// This avoids CORS/COEP conflicts from cross-origin fetch to localhost:8080.
export const TORII_URL = import.meta.env.VITE_TORII_URL
  ?? (import.meta.env.DEV ? '' : 'http://localhost:8080');

let clientInstance: ToriiClient | null = null;
let clientPromise: Promise<ToriiClient> | null = null;

export async function getToriiClient(): Promise<ToriiClient> {
  if (clientInstance) return clientInstance;
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    const config: ClientConfig = {
      toriiUrl: TORII_URL,
      worldAddress: WORLD_ADDRESS,
    };
    // WASM constructor returns a Promise — must be awaited
    const client = await new ToriiClient(config);
    clientInstance = client;
    return client;
  })();

  return clientPromise;
}

export function resetToriiClient(): void {
  if (clientInstance) {
    clientInstance.free();
    clientInstance = null;
  }
}

// Re-export types used by consumers
export type { Subscription, Entity, Clause, Query, Ty, Model } from '@dojoengine/torii-client';
