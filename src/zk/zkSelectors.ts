/**
 * ZK-specific selectors.
 *
 * Post-merge, these will be added to src/core/store/selectors.ts.
 * They're defined here to document what the ZK system reads from the store.
 *
 * Usage: import { useStarknetGameId, useProofError } from '../zk/zkSelectors';
 *
 * NOTE: These selectors reference `useGameStore` which won't exist
 * at this path until post-merge wiring. They serve as documentation
 * of what needs to be added to the main selectors file.
 */

// Post-merge, add these to src/core/store/selectors.ts:
//
// export const useStarknetGameId = () => useGameStore((s) => s.starknetGameId);
// export const useProofError = () => useGameStore((s) => s.proofError);
//
// These are already in the current feat branch's selectors.ts and will
// be carried over during the merge wiring step.
