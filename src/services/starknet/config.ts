/** Starknet configuration constants */

export const SCHIZODIO_CONTRACT =
  '0x077485a949c130cf0d98819d2b0749f5860b0734ea28cb678dd3f39379131bfa';

export const RPC_URL = 'https://api.cartridge.gg/x/starknet/mainnet';

// Starknet Mainnet chain ID
export const SN_MAIN_CHAIN_ID = '0x534e5f4d41494e';

// Game contract address — mainnet Dojo deployment
export const GAME_CONTRACT = '0x50ca0b06629af807a94c92ac75ee68658a1631340a57095a8e37f4290fbf1d3';

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
