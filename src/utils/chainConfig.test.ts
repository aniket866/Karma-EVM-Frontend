import { describe, expect, it } from 'vitest';
import { mainnet, sepolia } from 'viem/chains';
import { base } from './chains/Base';
import { getChainConfig } from './chainConfig';
import { getAddressExplorerUrl, getExplorerUrl } from './explorer';
import { validateChainId } from '@/lib/validation';

describe('Karma network configuration', () => {
  it('resolves Ethereum Mainnet, Sepolia, and Base Mainnet', () => {
    expect(getChainConfig(1)).toEqual({ chain: mainnet, name: 'Ethereum Mainnet' });
    expect(getChainConfig(11155111)).toEqual({ chain: sepolia, name: 'Sepolia Testnet' });
    expect(getChainConfig(8453)).toEqual({ chain: base, name: 'Base Mainnet' });
  });

  it('builds transaction and address links for all configured networks', () => {
    const hash = `0x${'1'.repeat(64)}` as `0x${string}`;
    const address = `0x${'2'.repeat(40)}` as `0x${string}`;

    expect(getExplorerUrl(hash, 1)).toBe(`https://etherscan.io/tx/${hash}`);
    expect(getAddressExplorerUrl(address, 1)).toBe(`https://etherscan.io/address/${address}`);
    expect(getExplorerUrl(hash, 11155111)).toBe(`https://sepolia.etherscan.io/tx/${hash}`);
    expect(getAddressExplorerUrl(address, 11155111)).toBe(`https://sepolia.etherscan.io/address/${address}`);
    expect(getExplorerUrl(hash, 8453)).toBe(`https://basescan.org/tx/${hash}`);
    expect(getAddressExplorerUrl(address, 8453)).toBe(`https://basescan.org/address/${address}`);
  });

  it('accepts only the chains supported by Karma storage', () => {
    expect(validateChainId(1)).toBe(1);
    expect(validateChainId('11155111')).toBe(11155111);
    expect(validateChainId('8453')).toBe(8453);
  });
});
