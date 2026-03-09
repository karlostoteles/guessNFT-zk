import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { WalletState, WalletActions } from './types';

const initialState: WalletState = {
  status: 'disconnected',
  address: null,
  username: null,
  ownedNFTs: [],
  error: null,
};

export const useWalletStore = create<WalletState & WalletActions>()(
  immer((set) => ({
    ...initialState,

    setStatus: (status) =>
      set((s) => {
        s.status = status;
      }),

    setAddress: (address) =>
      set((s) => {
        s.address = address;
      }),

    setUsername: (username) =>
      set((s) => {
        s.username = username;
      }),

    setOwnedNFTs: (nfts) =>
      set((s) => {
        s.ownedNFTs = nfts;
      }),

    setError: (error) =>
      set((s) => {
        s.error = error;
      }),

    reset: () =>
      set(() => ({ ...initialState })),
  }))
);

// Selectors (same pattern as src/store/selectors.ts)
export const useWalletStatus = () => useWalletStore((s) => s.status);
export const useWalletAddress = () => useWalletStore((s) => s.address);
export const useWalletUsername = () => useWalletStore((s) => s.username);
export const useOwnedNFTs = () => useWalletStore((s) => s.ownedNFTs);
export const useWalletError = () => useWalletStore((s) => s.error);
export const useIsWalletReady = () => useWalletStore((s) => s.status === 'ready');
