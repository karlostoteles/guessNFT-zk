/**
 * Torii WASM client — singleton instance for real-time Dojo entity sync.
 *
 * Replaces Supabase realtime. Uses @dojoengine/torii-client (WASM) directly
 * to subscribe to on-chain Game/Commitment/Board/Turn model updates.
 */
import { ToriiClient, type ClientConfig, type Subscription } from '@dojoengine/torii-client';
import { KATANA_RPC } from './config';

// World address — mainnet deployment (manifest_prod.json)
export const WORLD_ADDRESS =
  import.meta.env.VITE_WORLD_ADDRESS ?? '0x059081bb9aef4054c2898d83ed7ef3f971109fecec7da2360fb853b14f92c988';

// Torii indexer URL — Slot-hosted for mainnet, local proxy for dev.
export const TORII_URL = import.meta.env.VITE_TORII_URL
  ?? (import.meta.env.DEV ? '' : 'https://api.cartridge.gg/x/guessnft-zk/torii');

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
