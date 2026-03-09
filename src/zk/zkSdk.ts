/**
 * ZK SDK helpers — Starknet account access and field conversion utilities.
 *
 * Post-merge, getStarknetAccount moves into src/services/starknet/sdk.ts
 * and the field conversion helpers are used by useZKAnswer.ts.
 */
import { Account, RpcProvider } from 'starknet';
import type { AccountInterface } from 'starknet';
import {
  KATANA_RPC,
  KATANA_ACCOUNT_1,
  KATANA_PRIVATE_KEY_1,
  KATANA_ACCOUNT_2,
  KATANA_PRIVATE_KEY_2,
} from './config';

/**
 * Return a Starknet AccountInterface for submitting on-chain transactions.
 * - DEV (Katana): raw Account with katana private key
 * - PROD: returns null (Cartridge Controller account must be injected post-merge)
 */
export function getStarknetAccount(playerNum?: 1 | 2): AccountInterface | null {
  if (import.meta.env.DEV) {
    const provider = new RpcProvider({ nodeUrl: KATANA_RPC });
    const address = playerNum === 2 ? KATANA_ACCOUNT_2 : KATANA_ACCOUNT_1;
    const signer = playerNum === 2 ? KATANA_PRIVATE_KEY_2 : KATANA_PRIVATE_KEY_1;
    return new Account({ provider, address, signer });
  }
  // Post-merge: wire to Cartridge Controller's account via sdk.ts
  return null;
}

// ─── Field conversion utilities ───────────────────────────────────────────────

const U128_MASK = (1n << 128n) - 1n;

export function toBigInt(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  const v = value.trim();
  if (v.startsWith('0x') || v.startsWith('0X')) return BigInt(v);
  if (/^\d+$/.test(v)) return BigInt(v);
  throw new Error(`Expected numeric felt/u256 value, got "${value}"`);
}

export function toFeltHex(value: string | number | bigint): string {
  return `0x${toBigInt(value).toString(16)}`;
}

export function toDecimalField(value: string | number | bigint): string {
  return toBigInt(value).toString(10);
}

export function splitU256(value: string | number | bigint): [string, string] {
  const v = toBigInt(value);
  const low = toFeltHex(v & U128_MASK);
  const high = toFeltHex(v >> 128n);
  return [low, high];
}
