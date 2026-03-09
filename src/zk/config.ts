/** ZK-specific configuration constants */

// Schizodio Merkle tree root (all 999 characters, 418-bit bitmap schema)
export const TRAITS_ROOT = '0x296f3664665c3719c1498bd6642ed0e91d527b8d1e058fb6de45aaa5b88f9897';

// Game contract address (Katana local — from manifest_dev.json)
export const GAME_CONTRACT = '0x510009247cf7c71b0a085b4e4527d87120b2895fc330a3cc6cdccf59f0fae5f';

// Katana dev network
export const KATANA_RPC = 'http://localhost:5050';
export const KATANA_ACCOUNT_1 =
  '0x127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec';
export const KATANA_PRIVATE_KEY_1 =
  '0xc5b2fcab997346f3ea1c00b002ecf6f382c5f9c9659a3894eb783c5320f912';
export const KATANA_ACCOUNT_2 =
  '0x13d9ee239f33fea4f8785b9e3870ade909e20a9599ae7cd62c1c292b73af1b7';
export const KATANA_PRIVATE_KEY_2 =
  '0x1c9053c053edf324aec366a34c6901b1095b07af69495bffec7d7fe21effb1b';
// Backward-compat aliases
export const KATANA_ACCOUNT = KATANA_ACCOUNT_1;
export const KATANA_PRIVATE_KEY = KATANA_PRIVATE_KEY_1;

// Session policies for Cartridge Controller
export const SESSION_POLICIES: Array<{ target: string; method: string }> = [
  { target: GAME_CONTRACT, method: 'create_game' },
  { target: GAME_CONTRACT, method: 'join_game' },
  { target: GAME_CONTRACT, method: 'commit_character' },
  { target: GAME_CONTRACT, method: 'ask_question' },
  { target: GAME_CONTRACT, method: 'answer_question_with_proof' },
  { target: GAME_CONTRACT, method: 'make_guess' },
  { target: GAME_CONTRACT, method: 'reveal_character' },
  { target: GAME_CONTRACT, method: 'claim_timeout' },
];
