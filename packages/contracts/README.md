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

## Build and migrate

```bash
cd packages/contracts
sozo build
sozo migrate
```

## Toolchain

Version pins live in [`Scarb.toml`](Scarb.toml). At the time of this repo snapshot:

- Cairo: `2.13.1`
- Dojo: `1.8.0`

## Related packages

- [`../circuits`](../circuits): Noir circuit proving answer correctness
- [`../verifier`](../verifier): Garaga-generated verifier contract
