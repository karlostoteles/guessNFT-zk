/**
 * Wallet connection hooks using starkzap + Cartridge Controller.
 */
import { useCallback } from 'react';
import { useWalletStore } from './walletStore';
import { connectCartridgeWallet, resetSDK } from './sdk';
import { fetchAllOwnedNFTs } from './nftService';

/**
 * Hook for connecting/disconnecting wallet.
 */
export function useWalletConnection() {
  const store = useWalletStore;

  const connectWallet = useCallback(async () => {
    const state = store.getState();
    if (state.status === 'connecting' || state.status === 'ready') return;

    state.setStatus('connecting');
    state.setError(null);

    try {
      const wallet = await connectCartridgeWallet();

      // Extract address from the wallet
      const address = wallet.address;
      if (!address) throw new Error('No address returned from wallet');

      state.setAddress(address);
      state.setStatus('connected');

      // Try to get username
      try {
        if (wallet.username) {
          state.setUsername(typeof wallet.username === 'function'
            ? await wallet.username()
            : wallet.username);
        }
      } catch {
        // Username is optional
      }

      // Fetch NFTs
      state.setStatus('loading_nfts');
      try {
        const nfts = await fetchAllOwnedNFTs(address);
        state.setOwnedNFTs(nfts);
        state.setStatus('ready');
      } catch (err) {
        console.warn('[wallet] NFT fetch failed, wallet still connected:', err);
        state.setOwnedNFTs([]);
        state.setStatus('ready'); // Wallet is connected even if NFT fetch fails
      }
    } catch (err: any) {
      console.error('[wallet] Connection failed:', err);
      state.setError(err.message || 'Connection failed');
      state.setStatus('error');
    }
  }, [store]);

  const disconnectWallet = useCallback(() => {
    store.getState().reset();
    resetSDK();
  }, [store]);

  /** Re-fetch NFT metadata for the current address without disconnecting. */
  const refreshNFTs = useCallback(async () => {
    const state = store.getState();
    if (!state.address || state.status !== 'ready') return;
    state.setStatus('loading_nfts');
    try {
      const nfts = await fetchAllOwnedNFTs(state.address);
      state.setOwnedNFTs(nfts);
    } catch (err) {
      console.warn('[wallet] NFT refresh failed:', err);
    } finally {
      store.getState().setStatus('ready');
    }
  }, [store]);

  return { connectWallet, disconnectWallet, refreshNFTs };
}
