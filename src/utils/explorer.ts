// Explorer utility for Karma-EVM-Frontend platform
// Supported Karma network explorers.

export const getExplorerUrl = (hash: `0x${string}`, chainId: number): string => {
  const baseUrls: { [key: number]: string } = {
    1: "https://etherscan.io/tx/", // Ethereum Mainnet
    11155111: "https://sepolia.etherscan.io/tx/", // Sepolia Testnet
    8453: "https://basescan.org/tx/", // Base Mainnet
  };

  const baseUrl = baseUrls[chainId];
  if (!baseUrl) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  return `${baseUrl}${hash}`;
};

// Helper function to get explorer URL for addresses (not transactions)
export const getAddressExplorerUrl = (address: `0x${string}`, chainId: number): string => {
  const baseUrls: { [key: number]: string } = {
    1: "https://etherscan.io/address/", // Ethereum Mainnet
    11155111: "https://sepolia.etherscan.io/address/", // Sepolia Testnet
    8453: "https://basescan.org/address/", // Base Mainnet
  };

  const baseUrl = baseUrls[chainId];
  if (!baseUrl) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  return `${baseUrl}${address}`;
};
