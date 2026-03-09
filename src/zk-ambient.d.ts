// Ambient type declarations for ZK packages that don't ship .d.ts files.

declare module '@aztec/bb.js' {
  export interface Poseidon2PermutationInput {
    inputs: Uint8Array[];
  }
  export interface Poseidon2PermutationOutput {
    outputs: Uint8Array[];
  }
  export interface GenerateProofOptions {
    keccakZK?: boolean;
  }
  export interface ProofData {
    proof: Uint8Array;
    publicInputs: string[];
  }
  export class BarretenbergSync {
    static initSingleton(): Promise<void>;
    static getSingleton(): BarretenbergSync;
    poseidon2Permutation(input: Poseidon2PermutationInput): Poseidon2PermutationOutput;
  }
  export class UltraHonkBackend {
    constructor(bytecode: string, options?: { threads?: number });
    generateProof(witness: Uint8Array, options?: GenerateProofOptions): Promise<ProofData>;
    destroy(): void;
  }
}

declare module '@noir-lang/noir_js' {
  export interface ExecuteResult {
    witness: Uint8Array;
    returnValue?: unknown;
  }
  export class Noir {
    constructor(circuit: { bytecode: string; abi?: unknown });
    execute(inputs: Record<string, unknown>): Promise<ExecuteResult>;
    destroy(): void;
  }
}

declare module 'garaga' {
  export function init(): Promise<void>;
  export function getZKHonkCallData(
    proof: Uint8Array,
    publicInputs: Uint8Array,
    vk: Uint8Array,
  ): string[];
}

declare module '@dojoengine/torii-client' {
  export interface ClientConfig {
    toriiUrl: string;
    worldAddress: string;
    relayUrl?: string;
  }
  export interface Ty {
    type: string;
    value: unknown;
  }
  export interface Model {
    [key: string]: Ty;
  }
  export interface Entity {
    models: Record<string, Model>;
  }
  export type Entities = Record<string, Entity>;
  export interface Clause {
    Keys?: { keys: string[]; pattern_matching: string; models: string[] };
    HashedKeys?: string[];
    Member?: { model: string; member: string; operator: string; value: { Primitive: { Felt252: string } } };
  }
  export interface Pagination {
    limit: number;
    cursor: unknown;
    direction: string;
    order_by: unknown[];
  }
  export interface Query {
    world_addresses?: string[];
    pagination?: Pagination;
    clause?: Clause;
    no_hashed_keys?: boolean;
    models?: string[];
    historical?: boolean;
    limit?: number;
    offset?: number;
  }
  export interface Subscription {
    cancel(): void;
    free(): void;
  }
  export class ToriiClient {
    constructor(config: ClientConfig);
    getEntities(query: Query): Promise<Entities>;
    onEntityUpdated(
      clause: Clause,
      worldAddresses: string[],
      callback: (...args: unknown[]) => void,
    ): Promise<Subscription>;
    free(): void;
  }
}
