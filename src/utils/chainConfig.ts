import type { Chain } from "viem";
import { mainnet, sepolia } from "viem/chains";
import { base } from "./chains/Base";

export interface ChainConfig {
  chain: Chain;
  name: string;
}

export const getChainConfig = (chainId: number): ChainConfig | null => {
  switch (chainId) {
    case mainnet.id:
      return { chain: mainnet, name: "Ethereum Mainnet" };
    case sepolia.id: // 11155111
      return { chain: sepolia, name: "Sepolia Testnet" };
    case base.id: // 8453
      return { chain: base, name: "Base Mainnet" };
    default:
      return null;
  }
};
