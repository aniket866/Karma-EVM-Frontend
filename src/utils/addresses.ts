import { Address } from "viem";

// Factory addresses for deployed Karma Protocol contracts
// Update these with actual deployed contract addresses when available
export const KarmaPoolFactories: Record<number, Address> = {
  11155111: "0xc0becbba8ee6ba4efcedae6958ddcdba7d2540fb", // Sepolia Testnet - Deployed 2026-09-16 (tag sepolia-2026-09-16)
  // Add Base Mainnet (8453) only after the factory is deployed and verified.
};
export const FatePoolFactories = KarmaPoolFactories;

export const ChainlinkAdapterFactories: Record<number, Address> = {
  11155111: "0xe1e12da062e778c44d4518de88f9ad95273de0b8", // Sepolia Testnet - Deployed 2026-09-16 (tag sepolia-2026-09-16)
  // Add Base Mainnet (8453) only after the factory is deployed and verified.
};

// Karma oracle adapter factory addresses
// Update these with actual deployed contract addresses when available
export const KarmaAdapterFactories: Record<number, Address> = {
  // Add Base Mainnet (8453) only after the factory is deployed and verified.
};

// No pool can exist before its factory, so scans start here instead of guessing. Chains
// without an entry fall back to a block window.
export const FactoryDeploymentBlocks: Record<number, bigint> = {
  11155111: BigInt(11_715_454),
  // Add Base Mainnet (8453) factory deployment block after deployment.
};
