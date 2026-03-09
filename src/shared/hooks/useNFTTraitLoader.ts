/**
 * Enriches stub NFT characters with real trait attributes.
 *
 * When the user is in nft/online mode and has owned NFTs in their wallet,
 * fetches real traits for those token IDs via the serverless proxy and
 * applies them to the matching stub characters in the game store.
 *
 * In nft-free mode, fetches traits for both players' selected characters
 * (P1 selected + CPU auto-picked) once they are set — no wallet required.
 *
 * This bridges the gap between the 999 hash-derived stubs (no nft_* traits)
 * and the real SCHIZODIO attribute data (nft_hair, nft_has_mask, etc.)
 * that NFT questions (questions.ts zone:'nft') require for correct evaluation.
 *
 * Fires once per unique set of owned token IDs — safe to call on every render.
 */
import { useEffect } from 'react';
import { useGameMode } from '@/core/store/selectors';
import { useGameStore } from '@/core/store/gameStore';
import { useOwnedNFTs } from '@/services/starknet/walletStore';
import { fetchTraitsBatch } from '@/services/starknet/nftService';

export function useNFTTraitLoader(): void {
  const mode       = useGameMode();
  const ownedNFTs  = useOwnedNFTs();

  // Build a stable key from sorted token IDs so the effect only re-runs
  // when the wallet's NFT set actually changes, not on every render.
  const tokenKey = ownedNFTs.map((n) => n.tokenId).sort().join(',');

  // For nft-free: watch both players' secret character IDs.
  // CPU picks immediately after P1 selects, so both will be set together.
  const p1SecretId = useGameStore((s) => s.players.player1.secretCharacterId);
  const p2SecretId = useGameStore((s) => s.players.player2.secretCharacterId);
  const secretKey  = [p1SecretId ?? '', p2SecretId ?? ''].join(',');

  // nft / online: load real traits for wallet-owned tokens
  useEffect(() => {
    if (mode !== 'nft' && mode !== 'online') return;
    if (!tokenKey) return;

    const tokenIds = tokenKey.split(',');

    fetchTraitsBatch(tokenIds)
      .then((traitMap) => {
        useGameStore.getState().enrichNFTCharacters(traitMap);
        if (import.meta.env.DEV) {
        }
      })
      .catch((err) => {
        console.warn('[useNFTTraitLoader] Trait fetch failed:', err);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tokenKey]);

  // nft-free: load real traits for both selected characters (no wallet needed)
  useEffect(() => {
    if (mode !== 'nft-free') return;
    if (!p1SecretId || !p2SecretId) return;

    const tokenIds = [p1SecretId, p2SecretId]
      .filter((id) => id.startsWith('nft_'))
      .map((id) => id.replace('nft_', ''));

    if (tokenIds.length === 0) return;

    fetchTraitsBatch(tokenIds)
      .then((traitMap) => {
        useGameStore.getState().enrichNFTCharacters(traitMap);
        if (import.meta.env.DEV) {
        }
      })
      .catch((err) => {
        console.warn('[useNFTTraitLoader] nft-free trait fetch failed:', err);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, secretKey]);
}
