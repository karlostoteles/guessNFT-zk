/** Starknet configuration constants */

export const SCHIZODIO_CONTRACT =
  '0x077485a949c130cf0d98819d2b0749f5860b0734ea28cb678dd3f39379131bfa';

export const RPC_URL = 'https://api.cartridge.gg/x/starknet/mainnet';

// Starknet Mainnet chain ID
export const SN_MAIN_CHAIN_ID = '0x534e5f4d41494e';

// Game contract address — deployed when Phase 2 is ready
// Replace with actual address after deploying the Cairo/Dojo contract (Phase 2)
export const GAME_CONTRACT = '0x510009247cf7c71b0a085b4e4527d87120b2895fc330a3cc6cdccf59f0fae5f';

// Session policies for Cartridge Controller
// Phase 1: empty — read-only operations don't need sessions
// Phase 2: will include game contract methods (commit, reveal, ask, guess)
export const SESSION_POLICIES: Array<{ target: string; method: string }> = [
  { target: GAME_CONTRACT, method: 'create_game' },
  { target: GAME_CONTRACT, method: 'commit_character' },
  { target: GAME_CONTRACT, method: 'deposit_wager' },
  { target: GAME_CONTRACT, method: 'opponent_won' },
];
