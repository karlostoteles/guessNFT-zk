# guessNFT Local Dev Guide

This guide is for running the real onchain + ZK flow locally: Katana, Dojo world, Torii, frontend, and client-side proof generation.

## Prerequisites

Install these first:

```bash
katana --version
torii --version
sozo --version
scarb --version
sncast --version
nargo --version
bb --version
garaga --help
node --version
```

The root [`.tool-versions`](../.tool-versions) pins part of the toolchain. The Cairo/Dojo package versions are in:

- [`packages/contracts/Scarb.toml`](../packages/contracts/Scarb.toml)
- [`packages/verifier/Scarb.toml`](../packages/verifier/Scarb.toml)
- [`packages/circuits/Nargo.toml`](../packages/circuits/Nargo.toml)

## Architecture to keep in mind

Local development has two distinct execution paths:

- `src/zk/*`: the active ZK online game flow used by the app when you choose `zk-online`
- `src/services/starknet/*`: wallet/NFT integration and older compatibility helpers

For hackathon demos and proof generation, treat `src/zk/*` as the main source of truth.

## 1. Start Katana

Run Katana in a separate terminal:

```bash
katana --dev --dev.no-fee --http.cors_origins "*"
```

This exposes a local Starknet RPC at `http://localhost:5050` with pre-funded dev accounts.

## 2. Deploy the Garaga verifier and the Dojo world

In another terminal:

```bash
bash scripts/deploy-local.sh
```

That script does the following:

1. Imports the Katana dev account into `sncast`
2. Builds the Garaga verifier in `packages/verifier`
3. Declares and deploys the verifier on Katana
4. Patches the verifier address in [`packages/contracts/src/constants.cairo`](../packages/contracts/src/constants.cairo)
5. Builds and migrates the Dojo world
6. Writes `.deploy-local.env`

Important: the current script updates [`src/services/starknet/config.ts`](../src/services/starknet/config.ts), but the active ZK online flow also reads [`src/zk/config.ts`](../src/zk/config.ts). After deploy, confirm both point at the same local `GAME_CONTRACT`.

## 3. Start Torii

Run Torii with the world address produced by the migration:

```bash
torii --world <WORLD_ADDRESS> --rpc http://localhost:5050
```

Notes:

- In dev, the frontend proxies Torii calls through Vite to avoid COEP/CORS issues.
- If Torii is missing or pointed at the wrong world, the app will not sync turns correctly.

## 4. Start the frontend

```bash
npm install
npm run dev
```

The Vite app runs at `http://localhost:5173`.

## 5. Play the ZK online flow locally

Open two browser tabs to `http://localhost:5173`.

In both tabs:

1. Choose the `ONLINE` / ZK flow from the main menu
2. In dev mode, select `P1` in one tab and `P2` in the other from the lobby

Then:

1. Tab 1 clicks `Create Game`
2. Copy the returned `game_id`
3. Tab 2 clicks `Join Game` and pastes the `game_id`
4. Both players select a secret character
5. Commitments are submitted onchain
6. Player 1 asks a question
7. Player 2 generates a proof locally in the browser and submits it onchain
8. Torii sync updates both tabs

## Local accounts

The current local ZK flow uses raw Katana dev accounts from [`src/zk/config.ts`](../src/zk/config.ts):

| Player | Address |
| --- | --- |
| P1 | `0x127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec` |
| P2 | `0x13d9ee239f33fea4f8785b9e3870ade909e20a9599ae7cd62c1c292b73af1b7` |

That is a dev-only convenience path. The intended production UX is Cartridge Controller.

## Proof-related sanity checks

### Compile and prove locally from the command line

```bash
bash scripts/prove.sh
```

This runs:

1. `nargo build`
2. witness generation
3. `bb write_vk`
4. `bb prove`
5. `bb verify`
6. `garaga calldata`

### Validate the exact client proof pipeline

```bash
npx tsx scripts/test-client-proof-pipeline.ts
```

This checks the same flow used in the worker:

- Noir witness generation
- `bb.js` UltraHonk proof generation
- Garaga calldata formatting
- answer-bit correctness

### Validate end-to-end against Katana

```bash
npx tsx scripts/test-e2e-proof-submission.ts
```

This creates a game, joins it, commits, asks a question, generates a real proof, and submits it onchain.

## Collection preprocessing

The proof system depends on the generated collection snapshot in `public/collections/schizodio.json`.

If you need to rebuild it:

```bash
npx tsx scripts/prepare-collection.ts --verify
```

That script:

- builds the `418`-bit question schema
- packs each character into `[u128; 4]`
- builds a `1024`-leaf Poseidon2 Merkle tree
- writes each character's Merkle path
- emits the canonical `traits_root`

## Files that must stay in sync after deploy

Check these when debugging local mismatches:

- [`packages/contracts/src/constants.cairo`](../packages/contracts/src/constants.cairo): verifier address
- [`packages/contracts/manifest_dev.json`](../packages/contracts/manifest_dev.json): deployed world and game system addresses
- [`src/zk/config.ts`](../src/zk/config.ts): local game contract, traits root, Katana config
- [`src/services/starknet/config.ts`](../src/services/starknet/config.ts): wallet-facing Starknet config
- `.deploy-local.env`: deployment summary written by the script

## Common failure modes

### Torii sync never updates

- Torii is not running
- Torii is indexing the wrong world
- Vite is not running on `localhost:5173`

### Proof generation hangs or fails in browser

- COOP/COEP headers are missing
- the worker cannot load the verification key
- browser SharedArrayBuffer support is blocked

See [`src/zk/VITE_ZK_CONFIG.md`](../src/zk/VITE_ZK_CONFIG.md) for the required Vite settings.

### `answer_question_with_proof` reverts

Typical causes:

- wrong `game_id`
- wrong `turn_id`
- wrong answering player
- wrong `question_id`
- `traits_root` mismatch
- ZK commitment mismatch
- verifier not deployed

The contract checks those explicitly before it calls the Garaga verifier.

### Collection data mismatch

If the generated collection snapshot changes, all of these must agree again:

- question schema order
- bitmaps
- Merkle paths
- `traits_root`
- contract deployment data
- client proof inputs

## Recommended reading order

1. [README](../README.md)
2. [Architecture](./ARCHITECTURE.md)
3. [ZK Proof Flow](./ZK_PROOF_FLOW.md)
