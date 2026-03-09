/**
 * Cartridge Controller integration.
 * Static import — no dynamic import delay before connect() is called.
 */
import Controller from '@cartridge/controller';
import { RPC_URL, SN_MAIN_CHAIN_ID } from './config';

export interface ConnectedWallet {
  address: string;
  username?: () => Promise<string>;
}

let ctrl: InstanceType<typeof Controller> | null = null;
let currentAccount: any = null;

export function getController() {
  if (!ctrl) {
    ctrl = new Controller({
      defaultChainId: SN_MAIN_CHAIN_ID,
      chains: [{ rpcUrl: RPC_URL }],
    });
  }
  return ctrl;
}

export function getAccount() {
  if (!currentAccount) {
    throw new Error('Wallet not connected. Call connectCartridgeWallet first.');
  }
  return currentAccount;
}

/**
 * Open Cartridge login UI and return the connected wallet.
 */
export async function connectCartridgeWallet(): Promise<ConnectedWallet> {
  const controller = getController();

  const account = await controller.connect();

  if (!account?.address) {
    throw new Error('Login cancelled or failed — no account returned');
  }

  currentAccount = account;

  return {
    address: String(account.address),
    username: async () => {
      try {
        const name = await controller.username();
        return name ?? String(account.address).slice(0, 8);
      } catch {
        return String(account.address).slice(0, 8);
      }
    },
  };
}

export function resetSDK() {
  try { ctrl?.disconnect?.(); } catch { /* ignore */ }
  ctrl = null;
  currentAccount = null;
}
