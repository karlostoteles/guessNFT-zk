# ZK Proof Flow

This document explains the proof system from raw NFT data to an accepted onchain answer.

## The problem we need to solve

When a player is asked "Does your secret character have trait X?", the contract must learn the answer without learning the entire secret character.

That means the system needs to prove:

- the answer came from a real SCHIZODIO character
- the player committed to that same character earlier
- the answer matches the asked question
- the proof belongs to this exact game turn

## Step 0: preprocess the collection

The proof system depends on a generated snapshot of the SCHIZODIO collection.

That happens in:

- [`scripts/question-schema.ts`](../scripts/question-schema.ts)
- [`scripts/merkle.ts`](../scripts/merkle.ts)
- [`scripts/prepare-collection.ts`](../scripts/prepare-collection.ts)

The preprocessing pipeline does this:

1. Maps real NFT attributes into a stable question schema
2. Packs each character into a `[u128; 4]` bitmap
3. Builds a Poseidon2 Merkle tree over all characters
4. Stores each character's Merkle path
5. Emits the canonical `traits_root`

Output:

- [`public/collections/schizodio.json`](../public/collections/schizodio.json)

Important constants:

- `999` real characters
- `1024` Merkle leaves
- depth `10`
- `418` active question bits packed into `512` available bits

## Step 1: commit to the secret character

The game uses two commitments per player.

### Pedersen commitment

Used for the final reveal phase:

```text
pedersen(character_id, salt)
```

This is stored in the `Commitment.hash` field and later checked by `reveal_character`.

### Poseidon2 BN254 commitment

Used for the ZK answer path:

```text
hash4(game_id, player, character_id, salt)
```

This is stored in the `Commitment.zk_commitment` field and later checked inside `answer_question_with_proof`.

Why two commitments?

- Pedersen is a natural fit for Starknet-native commit/reveal
- Poseidon2 BN254 matches the Noir circuit and Merkle proof ecosystem used by `bb.js`

Client implementation:

- [`src/services/starknet/commitReveal.ts`](../src/services/starknet/commitReveal.ts)
- [`src/zk/zkCommitment.ts`](../src/zk/zkCommitment.ts)

## Step 2: the question is recorded onchain

The active player calls `ask_question(game_id, question_id)`.

The Cairo system:

- increments `turn_count`
- stores `last_question_id`
- creates a `Turn` record
- sets `awaiting_answer = true`

This is the moment the proof becomes bound to a unique onchain turn.

## Step 3: private inputs stay in the browser

When it is time to answer, the browser collects:

- `character_id`
- `salt`
- `trait_bitmap`
- `merkle_path`

Those are private inputs and never go onchain.

The browser also collects public inputs:

- `game_id`
- `turn_id`
- `player`
- `commitment`
- `question_id`
- `traits_root`

## Step 4: Noir builds the witness

The worker in [`src/zk/workers/prover.worker.ts`](../src/zk/workers/prover.worker.ts) calls Noir with those inputs.

The circuit in [`packages/circuits/src/main.nr`](../packages/circuits/src/main.nr) enforces three main constraints:

1. Commitment binding
2. Merkle membership
3. Answer-bit correctness

It returns one public output:

- `answer_bit`

That output becomes the verified yes/no answer that the contract will accept.

## Step 5: `bb.js` generates the proof in the client

After witness generation, the worker uses `UltraHonkBackend.generateProof(..., { keccakZK: true })`.

This matters because the proof is not a fake demo artifact or server-produced receipt. The actual browser session generates the real proof that will be submitted onchain.

The worker is used for two reasons:

- proof generation is expensive
- the WASM bundle is large enough that it should be reused, not recreated per answer

## Step 6: Garaga formats Starknet calldata

After the proof is generated, the client calls Garaga's `getZKHonkCallData(...)`.

Garaga converts:

- proof bytes
- public inputs
- verification key

into the calldata layout expected by the Cairo verifier contract.

The worker strips Garaga's internal length prefix and submits the remaining payload through the Starknet account.

## Step 7: Cairo validates the public inputs before cryptographic verification

Before the contract trusts the proof, it checks that the public inputs match the live game state.

The Cairo system validates:

- `proof_game_id == game_id`
- `proof_turn_id == game.turn_count`
- `proof_player == caller`
- `proof_question_id == game.last_question_id`
- `proof_traits_root == game.traits_root`
- `proof_commitment == stored zk_commitment`

Only then does it call the Garaga verifier.

This is critical. It means a proof cannot be replayed in:

- another game
- another turn
- another player's slot
- another question
- another collection snapshot

## Step 8: Garaga verifier checks the proof onchain

The game system calls:

- `verify_ultra_keccak_zk_honk_proof(...)`

from the Garaga-generated verifier interface in [`packages/contracts/src/interfaces/verifier.cairo`](../packages/contracts/src/interfaces/verifier.cairo).

If verification succeeds:

- the turn record is updated
- the answer is written onchain
- `proof_verified` is set to `true`
- the turn flips to the other player

At that point, the answer is no longer "claimed". It is a verified part of the game state.

## Public vs private data

| Data | Public or private | Where it lives |
| --- | --- | --- |
| `game_id` | Public | Dojo model / proof input |
| `turn_id` | Public | Dojo model / proof input |
| `player` | Public | Starknet address / proof input |
| `question_id` | Public | Dojo model / proof input |
| `traits_root` | Public | game creation input / proof input |
| `answer_bit` | Public | proof output |
| `character_id` | Private until reveal | client witness input |
| `salt` | Private until reveal | client witness input |
| `trait_bitmap` | Private witness material | client witness input |
| `merkle_path` | Private witness material | client witness input |

## Why this is only trustless with ZK

Without ZK, there are only bad options:

- reveal too much data onchain
- trust a server to check answers
- trust the player being questioned

The proof system removes that trust requirement while keeping the secret character hidden during play.

That is the key hackathon argument.

## Proof pipeline files

- Circuit: [`packages/circuits/src/main.nr`](../packages/circuits/src/main.nr)
- Merkle verifier: [`packages/circuits/src/merkle.nr`](../packages/circuits/src/merkle.nr)
- Client worker: [`src/zk/workers/prover.worker.ts`](../src/zk/workers/prover.worker.ts)
- Client orchestration: [`src/zk/useZKAnswer.ts`](../src/zk/useZKAnswer.ts)
- Commitment logic: [`src/zk/zkCommitment.ts`](../src/zk/zkCommitment.ts)
- Collection prep: [`scripts/prepare-collection.ts`](../scripts/prepare-collection.ts)
- Merkle helpers: [`scripts/merkle.ts`](../scripts/merkle.ts)
- Contract verifier path: [`packages/contracts/src/systems/game_actions.cairo`](../packages/contracts/src/systems/game_actions.cairo)

## Scripts that prove the proof system is real

```bash
bash scripts/prove.sh
npx tsx scripts/test-client-proof-pipeline.ts
npx tsx scripts/test-e2e-proof-submission.ts
```

Those are useful for demos because they show the exact stack working end to end:

- Noir
- `bb.js`
- Garaga
- Dojo/Cairo
- Starknet

## Terminology note

The proof language used in this repo is **Noir**. If you hear "Neur" in conversation, the code and toolchain here are referring to Noir.
