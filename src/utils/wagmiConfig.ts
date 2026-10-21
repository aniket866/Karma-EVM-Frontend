import { mainnet, sepolia } from "wagmi/chains";
import { createWalletLinkConfig } from "@stability-nexus/walletlink";
import { getTransport } from "./rpcTransport";
import { base } from "./chains/Base";

// Wallet connection is handled in-browser via EIP-6963 discovery: no
// WalletConnect relay and no projectId. Created once at module load.
export const config = createWalletLinkConfig({
  chains: [
    mainnet, // 1 - Ethereum Mainnet
    sepolia, // 11155111 - Sepolia Testnet
    base, // 8453 - Base Mainnet
  ],
  transports: {
    [mainnet.id]: getTransport(mainnet.id),
    [sepolia.id]: getTransport(sepolia.id),
    [base.id]: getTransport(base.id),
  },
  ssr: true, // Enable SSR for proper hydration
});
