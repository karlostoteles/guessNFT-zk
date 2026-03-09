# guessNFT Dojo Contracts

This package contains the onchain game logic for `guessNFT` built with Dojo and Cairo.

## What lives here

- the Dojo world models for games, commitments, and turns
- the Cairo system that enforces the match lifecycle
- the onchain bridge to the Garaga-generated verifier contract

The important files are:

- [`src/models/game.cairo`](src/models/game.cairo): `Game`, `Commitment`, and `Turn` models
- [`src/events.cairo`](src/events.cairo): indexed events for game actions
- [`src/interfaces/game_actions.cairo`](src/interfaces/game_actions.cairo): public system interface
- [`src/interfaces/verifier.cairo`](src/interfaces/verifier.cairo): Garaga verifier interface
- [`src/systems/game_actions.cairo`](src/systems/game_actions.cairo): main game rules
- [`src/constants.cairo`](src/constants.cairo): phase constants, timeout, verifier address

## Contract responsibilities

The Cairo system owns these rules onchain:

1. Create and join a game
2. Store both players' commitments
3. Enforce turn order and phase transitions
4. Record asked questions
5. Validate proof metadata
6. Call the Garaga verifier
7. Store verified answers
8. Resolve the final guess through reveal
9. Allow timeout claims when a player stalls

## Game phases

```text
WAITING_FOR_PLAYER2 -> COMMIT_PHASE -> PLAYING -> REVEAL -> COMPLETED
```

Inside `PLAYING`, `awaiting_answer` splits the flow:

- `false`: active player must ask or guess
- `true`: the other player must answer with a ZK proof

## Why the contract matters

The frontend is not trusted to enforce the rules. The contract is the authority for:

- whose turn it is
- which question is being answered
- which collection root is valid for this game
- whether the proof matches the committed character
- whether the final reveal is consistent with the original commitment

That is what makes the game actually onchain instead of just "a frontend that talks to a contract sometimes".

## Proof verification path

`answer_question_with_proof` in [`src/systems/game_actions.cairo`](src/systems/game_actions.cairo) performs two layers of checks:

### 1. Game-specific validation

The contract checks:

- `game_id`
- `turn_id`
- `player`
- `question_id`
- `traits_root`
- `zk_commitment`

### 2. Cryptographic verification

After those checks pass, it calls the Garaga-generated verifier and accepts the proof only if verification succeeds.

If successful, the contract extracts the answer bit from the proof's public outputs and writes the verified answer into the `Turn` model.

## Deployed addresses

### Starknet Sepolia

| Contract | Address |
|---|---|
| Garaga verifier (`UltraKeccakZKHonkVerifier`) | `0x64cb378d475b6247b0bbbe5ff5c3ec0615fbc2d63ed8e09b55e39c0a8597595` |
| Dojo world | `0x507034b9c9dbc0a9a2e093a53ccca22ac105a2f74c23fa33ee2c1a67b543563` |
| `game_actions` system | `0x62e30cd3bdca8569228c02f72979ccb2697db361f55a258a831cf7197a4be35` |

Explorer links:
- [Verifier on Voyager](https://sepolia.voyager.online/contract/0x64cb378d475b6247b0bbbe5ff5c3ec0615fbc2d63ed8e09b55e39c0a8597595)
- [World on Voyager](https://sepolia.voyager.online/contract/0x507034b9c9dbc0a9a2e093a53ccca22ac105a2f74c23fa33ee2c1a67b543563)
- [game_actions on Voyager](https://sepolia.voyager.online/contract/0x62e30cd3bdca8569228c02f72979ccb2697db361f55a258a831cf7197a4be35)

Deployment notes:
- Deployed with sncast `0.57.0` + sozo `1.8.6` (required for Sepolia blake2s CASM hashing)
- Full addresses also saved in `.deploy-sepolia.env` at project root

## Build and migrate

```bash
cd packages/contracts
sozo build
sozo migrate
```

## Toolchain

Version pins live in [`Scarb.toml`](Scarb.toml). At the time of this repo snapshot:

- Cairo: `2.13.1`
- Dojo: `1.8.0` (local) / `1.8.6` required for Sepolia deploy
- sncast: `0.51.2` (local) / `0.57.0` required for Sepolia declare

## Related packages

- [`../circuits`](../circuits): Noir circuit proving answer correctness
- [`../verifier`](../verifier): Garaga-generated verifier contract
