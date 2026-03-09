/**
 * Singleton ZK prover Web Worker.
 *
 * Runs proof generation off the main thread (30–120s on mobile).
 * DO NOT create a new Worker() per proof — the WASM binary is ~3.5MB.
 *
 * Pipeline:
 *   1. Noir witness generation (@noir-lang/noir_js)
 *   2. UltraHonk proof          (@aztec/bb.js)
 *   3. Garaga calldata format   (garaga)
 */
import { Noir } from '@noir-lang/noir_js';
import { UltraHonkBackend } from '@aztec/bb.js';
import { init as garagaInit, getZKHonkCallData } from 'garaga';
import circuit from '../../../packages/circuits/target/whoiswho_answer.json';
// VK served from public/ to avoid Vite asset transforms that corrupt binary data.
const vkUrl = '/vk.bin';

// bb.js doesn't re-export this from the main entry, so we inline it.
// Converts decimal-string field elements into a flat Uint8Array (32 bytes each).
function flattenFieldsAsArray(fields: string[]): Uint8Array {
  const result = new Uint8Array(fields.length * 32);
  for (let i = 0; i < fields.length; i++) {
    let v = BigInt(fields[i]);
    for (let j = 31; j >= 0; j--) {
      result[i * 32 + j] = Number(v & 0xffn);
      v >>= 8n;
    }
  }
  return result;
}

function toDecimalField(value: string | number | bigint): string {
  const raw = typeof value === 'string' ? value.trim() : String(value);
  if (raw.startsWith('0x') || raw.startsWith('0X')) {
    return BigInt(raw).toString(10);
  }
  if (/^\d+$/.test(raw)) return raw;
  throw new Error(`Invalid numeric field input: "${value}"`);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProveRequest {
  type: 'prove';
  id: string;
  // Public inputs (decimal strings, no 0x prefix)
  game_id: string;
  turn_id: string;
  player: string;
  commitment: string;
  question_id: number;
  traits_root: string;
  // Private inputs
  character_id: number;
  salt: string;
  bitmap: [string, string, string, string];
  merkle_path: string[];
}

export interface ProveResult {
  type: 'result';
  id: string;
  proofCalldata: string[];
  answerBit: number;
}

export interface ProveError {
  type: 'error';
  id: string;
  message: string;
}

export interface ProveProgress {
  type: 'progress';
  id: string;
  step: 'init' | 'witness' | 'proving' | 'formatting';
}

export type WorkerMessage = ProveResult | ProveError | ProveProgress;

// ─── Lazy singleton init ──────────────────────────────────────────────────────

let backend: UltraHonkBackend | null = null;
let noir: Noir | null = null;
let vk: Uint8Array | null = null;
let initPromise: Promise<void> | null = null;

async function ensureInit(): Promise<void> {
  if (backend && noir) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await garagaInit();
    backend = new UltraHonkBackend(circuit.bytecode, { threads: 1 });
    noir = new Noir(circuit as any);
    const res = await fetch(vkUrl);
    if (!res.ok) throw new Error(`Failed to load verification key: ${res.status}`);
    vk = new Uint8Array(await res.arrayBuffer());
  })();

  return initPromise;
}

// ─── Message handler ──────────────────────────────────────────────────────────

let currentId: string | null = null;

self.onmessage = async (e: MessageEvent<ProveRequest>) => {
  const { id } = e.data;
  currentId = id;

  try {
    const post = (msg: WorkerMessage) => self.postMessage(msg);

    post({ type: 'progress', id, step: 'init' });
    await ensureInit();

    // 1. Witness generation
    post({ type: 'progress', id, step: 'witness' });

    const bitmap = e.data.bitmap.map((v) => toDecimalField(v)) as [string, string, string, string];
    const merklePath = e.data.merkle_path.map((v) => toDecimalField(v));

    const { witness } = await noir!.execute({
      game_id: toDecimalField(e.data.game_id),
      turn_id: toDecimalField(e.data.turn_id),
      player: toDecimalField(e.data.player),
      commitment: toDecimalField(e.data.commitment),
      question_id: String(e.data.question_id),
      traits_root: toDecimalField(e.data.traits_root),
      character_id: String(e.data.character_id),
      salt: toDecimalField(e.data.salt),
      trait_bitmap: bitmap,
      merkle_path: merklePath,
    });

    // 2. Proof generation
    post({ type: 'progress', id, step: 'proving' });

    const proofData = await backend!.generateProof(witness, { keccakZK: true });

    // 3. Format calldata for Starknet via garaga
    post({ type: 'progress', id, step: 'formatting' });

    const piBytes = flattenFieldsAsArray(proofData.publicInputs);
    const calldataWithPrefix = getZKHonkCallData(proofData.proof, piBytes, vk!);
    if (calldataWithPrefix.length < 2) {
      throw new Error('Garaga calldata is unexpectedly short');
    }
    const declaredLen = Number(calldataWithPrefix[0]);
    if (declaredLen !== calldataWithPrefix.length - 1) {
      throw new Error(
        `Garaga calldata length prefix mismatch: declared ${declaredLen}, actual ${calldataWithPrefix.length - 1}`,
      );
    }
    // Garaga includes its own length prefix at index 0. Starknet Span ABI already carries a
    // length, so we send only the payload (without the embedded prefix).
    const calldata = calldataWithPrefix.slice(1);

    // Answer bit is the last public input (return value of circuit)
    const answerBit = Number(proofData.publicInputs[proofData.publicInputs.length - 1]);

    post({
      type: 'result',
      id,
      proofCalldata: calldata.map(String),
      answerBit,
    });
  } catch (err) {
    self.postMessage({
      type: 'error',
      id,
      message: err instanceof Error ? err.message : String(err),
    } satisfies ProveError);
  }
};

self.onerror = (err) => {
  if (currentId) {
    self.postMessage({
      type: 'error',
      id: currentId,
      message: String(err),
    } satisfies ProveError);
  }
};
