/** NFT and wallet types for Starknet integration */

export interface NFTAttribute {
  trait_type: string;
  value: string;
}

export interface SchizodioNFT {
  tokenId: string;
  name: string;
  imageUrl: string;
  attributes: NFTAttribute[];
}

export type WalletConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'loading_nfts'
  | 'ready'
  | 'error';

export interface WalletState {
  status: WalletConnectionStatus;
  address: string | null;
  username: string | null;
  ownedNFTs: SchizodioNFT[];
  error: string | null;
}

export interface WalletActions {
  setStatus: (status: WalletConnectionStatus) => void;
  setAddress: (address: string | null) => void;
  setUsername: (username: string | null) => void;
  setOwnedNFTs: (nfts: SchizodioNFT[]) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}
