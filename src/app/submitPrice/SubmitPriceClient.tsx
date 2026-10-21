'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  useAccount,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from 'wagmi';
import {
  formatUnits,
  parseUnits,
  type Address,
  isAddress,
  BaseError,
  ContractFunctionRevertedError,
  parseAbiItem,
} from 'viem';
import { KarmaABI } from '@/utils/abi/Karma';
import { KarmaAdapterFactoryABI } from '@/utils/abi/KarmaAdapterFactory';
import { PredictionPoolABI } from '@/utils/abi/PredictionPool';
import { ERC20ABI } from '@/utils/abi/ERC20';
import { KarmaAdapterFactories } from '@/utils/addresses';
import { toast } from 'sonner';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Info,
  RefreshCw,
  Send,
  Activity,
  Clock,
  Scale,
  Weight,
  User,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Search,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Layers,
} from 'lucide-react';
import { WalletLinkModal } from '@stability-nexus/walletlink';

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (val: bigint | undefined, decimals = 18, dp = 6): string => {
  if (val === undefined || val === null) return '—';
  const str = formatUnits(val, decimals);
  const num = Number(str);
  if (num === 0) return '0';
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: dp,
  });
};

const fmtTimestamp = (ts: bigint | undefined): string => {
  if (!ts || ts === BigInt(0)) return 'Never';
  return new Date(Number(ts) * 1000).toLocaleString();
};

const timeAgo = (ts: bigint | undefined): string => {
  if (!ts || ts === BigInt(0)) return 'Never';
  const now = Math.floor(Date.now() / 1000);
  const diff = now - Number(ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

interface PriceEvent {
  submitter: Address;
  price: bigint;
  weight: bigint;
  timestamp: bigint;
  txHash?: `0x${string}`;
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function SubmitPriceClient() {
  const searchParams = useSearchParams();
  const initialParam = searchParams.get('id') ?? searchParams.get('oracle') ?? searchParams.get('pool') ?? '';

  const { address: userAddress, isConnected, chain } = useAccount();
  const publicClient = usePublicClient();

  // Contract write states
  const { writeContract, data: txHash, isPending: isTxPending, error: txError, reset: resetTx } = useWriteContract();
  const { isLoading: isTxConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Creation contract write states
  const {
    writeContract: writeDeployKarma,
    data: deployTxHash,
    isPending: isDeployPending,
    error: deployError,
    reset: resetDeployTx,
  } = useWriteContract();
  const { isLoading: isDeployConfirming, isSuccess: isDeploySuccess } = useWaitForTransactionReceipt({ hash: deployTxHash });

  // Local state
  const [lookupMode, setLookupMode] = useState<'oracle' | 'pool'>('oracle');
  const [oracleAddressInput, setOracleAddressInput] = useState(initialParam);
  const [poolAddressInput, setPoolAddressInput] = useState('');
  const [activeKarmaAddress, setActiveKarmaAddress] = useState<Address | undefined>(
    isAddress(initialParam.trim()) ? (initialParam.trim() as Address) : undefined
  );

  const [priceInput, setPriceInput] = useState('');
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [isValidOracle, setIsValidOracle] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [recentEvents, setRecentEvents] = useState<PriceEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Deploy parameters state
  const [deployTau, setDeployTau] = useState('124651');
  const [deployMinBalance, setDeployMinBalance] = useState('100');
  const [deployDesc, setDeployDesc] = useState('Karma Oracle');
  const [showDeployDrawer, setShowDeployDrawer] = useState(false);

  const currentChainId = chain?.id ?? 11155111;
  const karmaFactoryAddress = KarmaAdapterFactories[currentChainId];

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Safe explorer URL helper
  const getExplorerTxLink = (hash: string) => {
    if (chain?.blockExplorers?.default?.url) {
      return `${chain.blockExplorers.default.url}/tx/${hash}`;
    }
    return `https://sepolia.etherscan.io/tx/${hash}`;
  };

  const getExplorerAddressLink = (addr: string) => {
    if (chain?.blockExplorers?.default?.url) {
      return `${chain.blockExplorers.default.url}/address/${addr}`;
    }
    return `https://sepolia.etherscan.io/address/${addr}`;
  };

  // ── On-chain Reads for Karma Contract ─────────────────────────────────────
  const {
    data: karmaData,
    refetch: refetchKarma,
    isLoading: isKarmaLoading,
  } = useReadContracts({
    contracts: [
      { address: activeKarmaAddress, abi: KarmaABI, functionName: 'description' },
      { address: activeKarmaAddress, abi: KarmaABI, functionName: 'readValue' },
      { address: activeKarmaAddress, abi: KarmaABI, functionName: 'readValueInterval' },
      { address: activeKarmaAddress, abi: KarmaABI, functionName: 'lastUpdated' },
      { address: activeKarmaAddress, abi: KarmaABI, functionName: 'submissionCount' },
      { address: activeKarmaAddress, abi: KarmaABI, functionName: 'tau' },
      { address: activeKarmaAddress, abi: KarmaABI, functionName: 'minTotalBalance' },
      { address: activeKarmaAddress, abi: KarmaABI, functionName: 'hasPrice' },
      { address: activeKarmaAddress, abi: KarmaABI, functionName: 'pool' },
      { address: activeKarmaAddress, abi: KarmaABI, functionName: 'baseToken' },
      { address: activeKarmaAddress, abi: KarmaABI, functionName: 'bullCoin' },
      { address: activeKarmaAddress, abi: KarmaABI, functionName: 'bearCoin' },
      { address: activeKarmaAddress, abi: KarmaABI, functionName: 'firstSubmissionTime' },
    ],
    query: { enabled: !!activeKarmaAddress },
  });

  const description = karmaData?.[0]?.result as string | undefined;
  const currentValue = karmaData?.[1]?.result as bigint | undefined;
  const valueInterval = karmaData?.[2]?.result as [bigint, bigint] | undefined;
  const lastUpdatedTs = karmaData?.[3]?.result as bigint | undefined;
  const submissionCount = karmaData?.[4]?.result as bigint | undefined;
  const tau = karmaData?.[5]?.result as bigint | undefined;
  const minTotalBalance = karmaData?.[6]?.result as bigint | undefined;
  const hasPrice = karmaData?.[7]?.result as boolean | undefined;
  const poolAddr = karmaData?.[8]?.result as Address | undefined;
  const baseTokenAddr = karmaData?.[9]?.result as Address | undefined;
  const bullCoinAddr = karmaData?.[10]?.result as Address | undefined;
  const bearCoinAddr = karmaData?.[11]?.result as Address | undefined;
  const firstSubmissionTs = karmaData?.[12]?.result as bigint | undefined;

  // Validation
  useEffect(() => {
    if (karmaData && description !== undefined && poolAddr !== undefined) {
      setIsValidOracle(true);
    } else if (karmaData && karmaData.slice(0, 2).some((d) => d.error)) {
      setIsValidOracle(false);
    }
  }, [karmaData, description, poolAddr]);

  // ── On-chain Reads for Pool Query (if user uses Pool mode) ────────────────
  const poolQueryAddress = isAddress(poolAddressInput.trim())
    ? (poolAddressInput.trim() as Address)
    : undefined;

  const { data: poolData, isLoading: isPoolLoading } = useReadContracts({
    contracts: [
      { address: poolQueryAddress, abi: PredictionPoolABI, functionName: 'poolName' },
      { address: poolQueryAddress, abi: PredictionPoolABI, functionName: 'oracle' },
      { address: poolQueryAddress, abi: PredictionPoolABI, functionName: 'baseToken' },
      { address: poolQueryAddress, abi: PredictionPoolABI, functionName: 'bullCoin' },
      { address: poolQueryAddress, abi: PredictionPoolABI, functionName: 'bearCoin' },
    ],
    query: { enabled: !!poolQueryAddress && lookupMode === 'pool' },
  });

  const poolName = poolData?.[0]?.result as string | undefined;
  const poolOracleAddress = poolData?.[1]?.result as Address | undefined;

  // Check if KarmaAdapterFactory has cached an oracle for this pool
  const { data: factoryCachedOracle, refetch: refetchFactoryKarma } = useReadContracts({
    contracts: [
      {
        address: karmaFactoryAddress,
        abi: KarmaAdapterFactoryABI,
        functionName: 'getKarma',
        args: poolQueryAddress ? [poolQueryAddress, BigInt(124651), BigInt(100e18)] : undefined,
      },
    ],
    query: { enabled: !!karmaFactoryAddress && !!poolQueryAddress },
  });

  const discoveredKarmaFromFactory = factoryCachedOracle?.[0]?.result as Address | undefined;

  // Auto-resolve oracle when entered via pool mode
  useEffect(() => {
    if (lookupMode === 'pool' && poolQueryAddress) {
      // 1. Check if the pool's own oracle is a valid Karma
      if (poolOracleAddress && poolOracleAddress !== '0x0000000000000000000000000000000000000000') {
        setActiveKarmaAddress(poolOracleAddress);
        return;
      }
      // 2. Otherwise check if factory has an instance
      if (
        discoveredKarmaFromFactory &&
        discoveredKarmaFromFactory !== '0x0000000000000000000000000000000000000000'
      ) {
        setActiveKarmaAddress(discoveredKarmaFromFactory);
      }
    }
  }, [lookupMode, poolQueryAddress, poolOracleAddress, discoveredKarmaFromFactory]);

  // ── On-chain Reads for User-Specific Data ─────────────────────────────────
  const { data: userData, refetch: refetchUser } = useReadContracts({
    contracts: [
      {
        address: activeKarmaAddress,
        abi: KarmaABI,
        functionName: 'getWeight',
        args: userAddress ? [userAddress] : undefined,
      },
      {
        address: activeKarmaAddress,
        abi: KarmaABI,
        functionName: 'getSubmission',
        args: userAddress ? [userAddress] : undefined,
      },
      {
        address: bullCoinAddr,
        abi: ERC20ABI,
        functionName: 'balanceOf',
        args: userAddress ? [userAddress] : undefined,
      },
      {
        address: bearCoinAddr,
        abi: ERC20ABI,
        functionName: 'balanceOf',
        args: userAddress ? [userAddress] : undefined,
      },
      { address: bullCoinAddr, abi: ERC20ABI, functionName: 'symbol' },
      { address: bearCoinAddr, abi: ERC20ABI, functionName: 'symbol' },
      { address: baseTokenAddr, abi: ERC20ABI, functionName: 'symbol' },
    ],
    query: {
      enabled: !!activeKarmaAddress && !!userAddress && !!bullCoinAddr && !!bearCoinAddr,
    },
  });

  const userWeight = userData?.[0]?.result as bigint | undefined;
  const userSubmission = userData?.[1]?.result as [bigint, bigint, bigint] | undefined;
  const bullBalance = userData?.[2]?.result as bigint | undefined;
  const bearBalance = userData?.[3]?.result as bigint | undefined;
  const bullSymbol = userData?.[4]?.result as string | undefined;
  const bearSymbol = userData?.[5]?.result as string | undefined;
  const baseSymbol = userData?.[6]?.result as string | undefined;

  const userSubmittedPrice = userSubmission?.[0];
  const userSubmittedWeight = userSubmission?.[1];
  const userSubmittedTime = userSubmission?.[2];

  // ── Fetch Recent PriceSubmitted Events ────────────────────────────────────
  const fetchRecentEvents = useCallback(async () => {
    if (!publicClient || !activeKarmaAddress || !isValidOracle) return;
    setIsLoadingEvents(true);
    try {
      const logs = await publicClient.getLogs({
        address: activeKarmaAddress,
        event: parseAbiItem(
          'event PriceSubmitted(address indexed submitter, uint256 price, uint256 weight, uint256 timestamp)'
        ),
        fromBlock: 'earliest',
      });

      const formatted: PriceEvent[] = logs
        .map((log) => ({
          submitter: log.args.submitter as Address,
          price: log.args.price as bigint,
          weight: log.args.weight as bigint,
          timestamp: log.args.timestamp as bigint,
          txHash: log.transactionHash,
        }))
        .reverse()
        .slice(0, 10);

      setRecentEvents(formatted);
    } catch (e) {
      console.warn('Could not fetch past PriceSubmitted logs:', e);
    } finally {
      setIsLoadingEvents(false);
    }
  }, [publicClient, activeKarmaAddress, isValidOracle]);

  useEffect(() => {
    if (activeKarmaAddress && isValidOracle) {
      fetchRecentEvents();
    }
  }, [activeKarmaAddress, isValidOracle, fetchRecentEvents]);

  // ── Price Submission Handler ──────────────────────────────────────────────
  const handleSubmitPrice = useCallback(() => {
    if (!activeKarmaAddress || !priceInput.trim()) return;

    let priceWei: bigint;
    try {
      priceWei = parseUnits(priceInput.trim(), 18);
    } catch {
      toast.error('Invalid price format. Please enter a valid decimal number.');
      return;
    }

    if (priceWei === BigInt(0)) {
      toast.error('Price observation must be greater than zero.');
      return;
    }

    writeContract({
      address: activeKarmaAddress,
      abi: KarmaABI,
      functionName: 'submitPrice',
      args: [priceWei],
    });
  }, [activeKarmaAddress, priceInput, writeContract]);

  // ── Deploy Karma Oracle for Pool Handler ──────────────────────────────────
  const handleDeployKarmaForPool = useCallback(() => {
    if (!poolQueryAddress) {
      toast.error('Please enter a valid pool address.');
      return;
    }
    if (!karmaFactoryAddress) {
      toast.error('KarmaAdapterFactory address not configured for this network.');
      return;
    }

    let parsedMinBalance: bigint;
    let parsedTau: bigint;
    try {
      parsedMinBalance = parseUnits(deployMinBalance.trim(), 18);
      parsedTau = BigInt(deployTau.trim());
    } catch {
      toast.error('Invalid parameters for deployment.');
      return;
    }

    writeDeployKarma({
      address: karmaFactoryAddress,
      abi: KarmaAdapterFactoryABI,
      functionName: 'createKarma',
      args: [poolQueryAddress, parsedTau, parsedMinBalance, deployDesc.trim() || 'Karma Oracle'],
    });
  }, [
    poolQueryAddress,
    karmaFactoryAddress,
    deployMinBalance,
    deployTau,
    deployDesc,
    writeDeployKarma,
  ]);

  // Tx status toasts for Price Submission
  useEffect(() => {
    if (isTxSuccess) {
      toast.success('Price observation submitted successfully!');
      setPriceInput('');
      refetchKarma();
      refetchUser();
      fetchRecentEvents();
      resetTx();
    }
  }, [isTxSuccess, refetchKarma, refetchUser, fetchRecentEvents, resetTx]);

  useEffect(() => {
    if (txError) {
      let msg = 'Transaction failed.';
      if (txError instanceof BaseError) {
        const revert = txError.walk((e) => e instanceof ContractFunctionRevertedError);
        if (revert instanceof ContractFunctionRevertedError) {
          const name = revert.data?.errorName;
          if (name === 'ZeroPrice') msg = 'Price must be greater than zero.';
          else if (name === 'InsufficientBalance')
            msg = 'Your total bull/bear holdings are below the minimum threshold required by this oracle.';
          else if (name === 'ZeroWeight')
            msg = 'Your neutrality weight is zero — you must hold both bull and bear coins in balanced economic proportion.';
          else if (name) msg = `Contract error: ${name}`;
        } else {
          msg = txError.shortMessage || txError.message;
        }
      }
      toast.error(msg);
    }
  }, [txError]);

  // Tx status toasts for Deploy
  useEffect(() => {
    if (isDeploySuccess) {
      toast.success('Karma oracle deployed successfully!');
      refetchFactoryKarma();
      resetDeployTx();
      setShowDeployDrawer(false);
    }
  }, [isDeploySuccess, refetchFactoryKarma, resetDeployTx]);

  useEffect(() => {
    if (deployError) {
      const msg = deployError instanceof BaseError ? deployError.shortMessage || deployError.message : deployError.message;
      toast.error(`Deployment failed: ${msg}`);
    }
  }, [deployError]);

  const handleRefresh = () => {
    refetchKarma();
    if (userAddress) refetchUser();
    fetchRecentEvents();
    toast.info('Data refreshed');
  };

  // Eligibility metrics
  const totalUserBalance = (bullBalance ?? BigInt(0)) + (bearBalance ?? BigInt(0));
  const meetsMinBalance = minTotalBalance ? totalUserBalance >= minTotalBalance : undefined;
  const hasWeight = userWeight !== undefined && userWeight > BigInt(0);

  // Neutrality percentage calculation
  const neutralityRatio = useMemo(() => {
    if (!bullBalance && !bearBalance) return 50;
    const b = Number(bullBalance ?? BigInt(0));
    const s = Number(bearBalance ?? BigInt(0));
    const sum = b + s;
    if (sum === 0) return 50;
    return Math.round((b / sum) * 100);
  }, [bullBalance, bearBalance]);

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 bg-transparent transition-colors">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* ── Page Header ── */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-stone-900 dark:text-stone-100 font-sans">
            Karma Oracle
          </h1>
          <p className="max-w-2xl mx-auto text-stone-600 dark:text-stone-400 text-sm md:text-base leading-relaxed">
            Submit price observations to the internal on-chain oracle. Your influence is mathematically weighted by the economic neutrality of your Bull and Bear holdings.
          </p>
        </div>

        {/* ── Lookup Mode Selector Card ── */}
        <div className="bg-white dark:bg-[#151823] border border-stone-200/80 dark:border-amber-900/25 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 dark:border-amber-900/20 pb-4">
            <div className="flex items-center gap-2">
              <Search size={18} className="text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                Select Oracle or Prediction Pool
              </span>
            </div>
            <div className="flex bg-stone-100 dark:bg-[#1a1d28] p-1 rounded-xl text-xs font-medium">
              <button
                onClick={() => setLookupMode('oracle')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  lookupMode === 'oracle'
                    ? 'bg-amber-600 dark:bg-amber-500 text-white dark:text-stone-950 shadow-xs font-bold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                Oracle Address
              </button>
              <button
                onClick={() => setLookupMode('pool')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  lookupMode === 'pool'
                    ? 'bg-amber-600 dark:bg-amber-500 text-white dark:text-stone-950 shadow-xs font-bold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                Prediction Pool
              </button>
            </div>
          </div>

          {lookupMode === 'oracle' ? (
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Karma Oracle Contract Address
              </label>
              <div className="flex gap-2.5">
                <Input
                  type="text"
                  value={oracleAddressInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setOracleAddressInput(val);
                    if (isAddress(val.trim())) {
                      setActiveKarmaAddress(val.trim() as Address);
                    }
                  }}
                  placeholder="0x... (Karma oracle address)"
                  className="flex-1 font-mono text-sm rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 focus-visible:ring-violet-500"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={!activeKarmaAddress}
                  className="shrink-0 rounded-xl"
                  title="Refresh Oracle State"
                >
                  <RefreshCw size={16} className={isKarmaLoading ? 'animate-spin' : ''} />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Prediction Pool Address
              </label>
              <div className="flex gap-2.5">
                <Input
                  type="text"
                  value={poolAddressInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPoolAddressInput(val);
                  }}
                  placeholder="0x... (Karma PredictionPool address)"
                  className="flex-1 font-mono text-sm rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 focus-visible:ring-violet-500"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={!poolQueryAddress}
                  className="shrink-0 rounded-xl"
                >
                  <RefreshCw size={16} className={isPoolLoading ? 'animate-spin' : ''} />
                </Button>
              </div>

              {poolQueryAddress && poolName && (
                <div className="flex items-center justify-between p-3 bg-violet-50/70 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900 rounded-xl text-xs text-violet-700 dark:text-violet-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-violet-600" />
                    <span>Pool loaded: <strong>{poolName}</strong></span>
                  </div>
                  {activeKarmaAddress && (
                    <span className="font-mono text-[11px] opacity-80">
                      Oracle: {activeKarmaAddress.slice(0, 6)}…{activeKarmaAddress.slice(-4)}
                    </span>
                  )}
                </div>
              )}

              {poolQueryAddress && !poolOracleAddress && !discoveredKarmaFromFactory && !isPoolLoading && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={18} className="shrink-0 text-amber-600" />
                    <span>
                      {karmaFactoryAddress
                        ? 'No Karma oracle instance found for this pool yet.'
                        : `KarmaAdapterFactory is not configured for ${chain?.name ?? `chain ${currentChainId}`}, so an oracle cannot be deployed from this page yet.`}
                    </span>
                  </div>
                  {karmaFactoryAddress && (
                    <Button
                      size="sm"
                      onClick={() => setShowDeployDrawer(true)}
                      className="bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shrink-0"
                    >
                      Deploy Karma for this Pool
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Validation Notice */}
          {activeKarmaAddress && !isKarmaLoading && !isValidOracle && (
            <div className="flex items-center gap-2 p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/80 rounded-xl text-sm text-red-700 dark:text-red-400">
              <AlertTriangle size={18} className="shrink-0" />
              <span>
                Address <code>{activeKarmaAddress}</code> does not appear to be a valid Karma oracle contract on chain {chain?.name ?? currentChainId}.
              </span>
            </div>
          )}
        </div>

        {/* ── Deploy Drawer Card (when deploying Karma instance) ── */}
        {showDeployDrawer && (
          <div className="bg-white dark:bg-[#151823] border border-amber-300 dark:border-amber-700/60 rounded-2xl p-6 space-y-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-amber-500" />
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  Deploy New Karma Oracle for Pool
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeployDrawer(false)}
                className="text-xs text-zinc-400"
              >
                Close
              </Button>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Creates an immutable, ownerless Karma oracle linked to this prediction pool through the <code>KarmaAdapterFactory</code>.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Decay Time Constant (τ in sec)
                </label>
                <Input
                  value={deployTau}
                  onChange={(e) => setDeployTau(e.target.value)}
                  placeholder="124651"
                  className="font-mono text-xs rounded-xl"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">Default: 124651 (~34.6 hours)</span>
              </div>
              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Min Total Balance (tokens)
                </label>
                <Input
                  value={deployMinBalance}
                  onChange={(e) => setDeployMinBalance(e.target.value)}
                  placeholder="100"
                  className="font-mono text-xs rounded-xl"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">Default: 100 base units</span>
              </div>
              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Description
                </label>
                <Input
                  value={deployDesc}
                  onChange={(e) => setDeployDesc(e.target.value)}
                  placeholder="Karma Oracle Feed"
                  className="text-xs rounded-xl"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">Oracle identification</span>
              </div>
            </div>

            <Button
              onClick={handleDeployKarmaForPool}
              disabled={isDeployPending || isDeployConfirming || !isConnected || !karmaFactoryAddress}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white rounded-xl py-2.5 font-semibold text-sm"
            >
              {isDeployPending
                ? 'Confirm in Wallet…'
                : isDeployConfirming
                ? 'Deploying on-chain…'
                : 'Deploy Oracle Instance'}
            </Button>
          </div>
        )}

        {/* ── Active Oracle Overview Card ── */}
        {activeKarmaAddress && isValidOracle && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
            {/* Header info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                    {description || 'Karma Oracle'}
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 dark:text-zinc-400">
                  <span>{activeKarmaAddress}</span>
                  <button
                    onClick={() => handleCopy(activeKarmaAddress, 'oracle-addr')}
                    className="hover:text-zinc-800 dark:hover:text-white transition-colors"
                    title="Copy address"
                  >
                    {copiedText === 'oracle-addr' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  </button>
                  <a
                    href={getExplorerAddressLink(activeKarmaAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-zinc-800 dark:hover:text-white transition-colors"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>

              {/* Linked Pool Button */}
              {poolAddr && (
                <Link
                  href={`/${poolAddr}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors"
                >
                  <Layers size={14} className="text-violet-500" />
                  <span>View Linked Prediction Pool</span>
                  <ArrowUpRight size={14} />
                </Link>
              )}
            </div>

            {/* Prominent Price Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gradient-to-br from-amber-50/80 via-orange-50/20 to-amber-100/30 dark:from-amber-950/20 dark:via-[#1a1d28] dark:to-[#151823] border border-amber-200/80 dark:border-amber-900/40 rounded-2xl p-5 shadow-sm">
              <div className="space-y-1 md:col-span-1">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Activity size={14} />
                  Consensus Value
                </span>
                <div className="text-2xl md:text-3xl font-extrabold text-stone-900 dark:text-stone-100 font-mono">
                  {hasPrice ? `${fmt(currentValue)}` : 'No price yet'}
                </div>
                <div className="text-xs text-stone-500 dark:text-stone-400">
                  {hasPrice ? 'Decay-averaged from on-chain submissions' : 'Awaiting initial observations'}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                  <Clock size={14} />
                  Last Updated
                </span>
                <div className="text-base font-semibold text-stone-800 dark:text-stone-200">
                  {fmtTimestamp(lastUpdatedTs)}
                </div>
                <div className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                  {timeAgo(lastUpdatedTs)}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Scale size={14} />
                  Value Interval
                </span>
                <div className="text-base font-semibold text-zinc-800 dark:text-zinc-200 font-mono">
                  {valueInterval ? `[${fmt(valueInterval[0], 18, 4)}, ${fmt(valueInterval[1], 18, 4)}]` : '—'}
                </div>
                <div className="text-xs text-zinc-500">
                  Min and Max consensus bounds
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-xl p-3.5 space-y-1">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400 flex items-center gap-1">
                  <Send size={12} /> Submissions
                </div>
                <div className="text-lg font-bold text-zinc-900 dark:text-white font-mono">
                  {submissionCount?.toString() ?? '0'}
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-xl p-3.5 space-y-1">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400 flex items-center gap-1">
                  <Clock size={12} /> Decay Constant (τ)
                </div>
                <div className="text-lg font-bold text-zinc-900 dark:text-white font-mono">
                  {tau ? `${tau}s` : '—'}
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-xl p-3.5 space-y-1">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400 flex items-center gap-1">
                  <Weight size={12} /> Min Balance
                </div>
                <div className="text-lg font-bold text-zinc-900 dark:text-white font-mono">
                  {minTotalBalance ? fmt(minTotalBalance, 18, 0) : '—'}
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-xl p-3.5 space-y-1">
                <div className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400 flex items-center gap-1">
                  <Clock size={12} /> First Submission
                </div>
                <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  {fmtTimestamp(firstSubmissionTs)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── User Neutrality & Eligibility Breakdown ── */}
        {activeKarmaAddress && isValidOracle && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-2">
                <User size={20} className="text-violet-500" />
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                  Your Holdings & Neutrality Weight
                </h2>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                      <Info size={16} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Influence in Karma is proportional to the minimum of your Bull and Bear exposures:
                    Weight = min(Bull normalized, Bear normalized). Holding only one side gives zero influence.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {!isConnected ? (
              <div className="text-center py-6 space-y-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Connect your Web3 wallet to check your holdings and neutrality influence.
                </p>
                <Button
                  onClick={() => setWalletModalOpen(true)}
                  className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl px-6 text-xs font-semibold"
                >
                  Connect Wallet
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Balance Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/70 rounded-xl p-4">
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                      <TrendingUp size={12} /> {bullSymbol || 'Bull Coin'}
                    </span>
                    <div className="text-lg font-bold text-zinc-900 dark:text-white font-mono mt-1">
                      {fmt(bullBalance)}
                    </div>
                  </div>

                  <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/70 rounded-xl p-4">
                    <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1">
                      <TrendingDown size={12} /> {bearSymbol || 'Bear Coin'}
                    </span>
                    <div className="text-lg font-bold text-zinc-900 dark:text-white font-mono mt-1">
                      {fmt(bearBalance)}
                    </div>
                  </div>

                  <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                    <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                      <Weight size={12} /> Total Position
                    </span>
                    <div className="text-lg font-bold text-zinc-900 dark:text-white font-mono mt-1">
                      {fmt(totalUserBalance)}
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      Min req: {fmt(minTotalBalance, 18, 0)} {baseSymbol || 'Tokens'}
                    </div>
                  </div>

                  <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-xl p-4">
                    <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
                      <Scale size={12} /> Neutrality Weight
                    </span>
                    <div className="text-lg font-bold text-amber-900 dark:text-amber-100 font-mono mt-1">
                      {hasWeight ? fmt(userWeight) : '0'}
                    </div>
                    <div className="text-[10px] text-amber-700 dark:text-amber-400">
                      {hasWeight ? 'Active voting power' : 'Zero influence'}
                    </div>
                  </div>
                </div>

                {/* Neutrality Gauge Bar */}
                <div className="space-y-2 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-xl p-4">
                  <div className="flex justify-between text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      Bull: {neutralityRatio}%
                    </span>
                    <span className="text-zinc-400 text-[11px]">
                      50/50 Balance = Maximum Economic Weight
                    </span>
                    <span className="text-rose-600 font-semibold flex items-center gap-1">
                      Bear: {100 - neutralityRatio}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 transition-all duration-300"
                      style={{ width: `${neutralityRatio}%` }}
                    />
                    <div
                      className="bg-rose-500 transition-all duration-300"
                      style={{ width: `${100 - neutralityRatio}%` }}
                    />
                  </div>
                </div>

                {/* Eligibility Alerts & Guidance */}
                {meetsMinBalance === false && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <strong>Insufficient Total Holdings</strong> — You have {fmt(totalUserBalance)} tokens, but the oracle requires at least {fmt(minTotalBalance, 18, 0)} total tokens.
                      </div>
                    </div>
                    {poolAddr && (
                      <Link
                        href={`/${poolAddr}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold shrink-0"
                      >
                        Buy Tokens in Pool <ArrowUpRight size={12} />
                      </Link>
                    )}
                  </div>
                )}

                {meetsMinBalance && !hasWeight && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <strong>Zero Neutrality Weight</strong> — You meet the balance requirement, but your position is 100% one-sided. To gain oracle influence, acquire an equal economic value in the opposing coin.
                      </div>
                    </div>
                    {poolAddr && (
                      <Link
                        href={`/${poolAddr}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold shrink-0"
                      >
                        Rebalance in Pool <ArrowUpRight size={12} />
                      </Link>
                    )}
                  </div>
                )}

                {/* User Previous Submission */}
                {userSubmittedTime && userSubmittedTime > BigInt(0) && (
                  <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                        Your Current Recorded Submission
                      </span>
                      <span className="text-[11px] text-stone-500">
                        Submitted {timeAgo(userSubmittedTime)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-stone-500 block">Reported Price</span>
                        <span className="font-mono font-semibold text-stone-900 dark:text-white">
                          {fmt(userSubmittedPrice)}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-500 block">Applied Weight</span>
                        <span className="font-mono font-semibold text-stone-900 dark:text-white">
                          {fmt(userSubmittedWeight)}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-500 block">Timestamp</span>
                        <span className="text-stone-700 dark:text-stone-300">
                          {fmtTimestamp(userSubmittedTime)}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 italic">
                      Submitting a new price replaces your previous entry. Non-accumulating resubmission prevents spam weight amplification.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Price Submission Form ── */}
        {activeKarmaAddress && isValidOracle && (
          <div className="bg-white dark:bg-[#151823] border border-stone-200/80 dark:border-amber-900/25 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
            <div className="border-b border-stone-100 dark:border-amber-900/20 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send size={20} className="text-amber-600 dark:text-amber-400" />
                <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                  Submit Price Observation
                </h2>
              </div>
              {currentValue && currentValue > BigInt(0) && (
                <button
                  type="button"
                  onClick={() => setPriceInput(formatUnits(currentValue, 18))}
                  className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline"
                >
                  Use Current Consensus Price
                </button>
              )}
            </div>

            {!isConnected ? (
              <div className="text-center py-6 space-y-4">
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  Please connect your wallet to participate in oracle consensus.
                </p>
                <Button
                  onClick={() => setWalletModalOpen(true)}
                  className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-stone-950 font-bold rounded-xl px-8 shadow-md shadow-amber-600/20"
                >
                  Connect Wallet
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                      Price Value (18 Decimals WAD)
                    </label>
                    {priceInput && (
                      <span className="text-[11px] font-mono text-stone-400">
                        {priceInput} = {tryParseWad(priceInput)} WAD
                      </span>
                    )}
                  </div>
                  <Input
                    type="text"
                    value={priceInput}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^[0-9]*\.?[0-9]*$/.test(v)) setPriceInput(v);
                    }}
                    placeholder="e.g. 2500.50"
                    className="font-mono text-base py-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700 focus-visible:ring-amber-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSubmitPrice();
                    }}
                  />
                  <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400">
                    Enter your honest observation of the fair market price. Your submission will be incorporated into the time-decayed consensus average based on your neutrality weight.
                  </p>
                </div>

                <Button
                  onClick={handleSubmitPrice}
                  disabled={
                    !priceInput.trim() ||
                    isTxPending ||
                    isTxConfirming ||
                    meetsMinBalance === false ||
                    !hasWeight
                  }
                  className="w-full bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-stone-950 rounded-xl py-3.5 text-sm font-bold transition-all shadow-md shadow-amber-600/20 disabled:opacity-50"
                >
                  {isTxPending
                    ? 'Confirm in Wallet…'
                    : isTxConfirming
                    ? 'Confirming Transaction…'
                    : meetsMinBalance === false
                    ? 'Insufficient Token Holdings'
                    : !hasWeight
                    ? 'Zero Neutrality Weight (Rebalance First)'
                    : 'Submit Price Observation'}
                </Button>

                {/* Progress Indicators */}
                {isTxPending && (
                  <p className="text-center text-xs text-amber-700 dark:text-amber-400 animate-pulse font-medium">
                    Please approve the price submission in your wallet…
                  </p>
                )}
                {isTxConfirming && (
                  <div className="flex items-center justify-center gap-2 text-xs text-stone-500 animate-pulse">
                    <Loading size="sm" />
                    <span>Confirming on-chain transaction…</span>
                  </div>
                )}
                {txHash && (
                  <div className="text-center">
                    <a
                      href={getExplorerTxLink(txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-amber-700 dark:text-amber-400 hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      View transaction on explorer <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Recent Activity / Community Submissions Feed ── */}
        {activeKarmaAddress && isValidOracle && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 md:p-8 space-y-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-violet-500" />
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Recent Price Observations
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchRecentEvents}
                disabled={isLoadingEvents}
                className="text-xs text-zinc-500 hover:text-zinc-900"
              >
                <RefreshCw size={12} className={`mr-1 ${isLoadingEvents ? 'animate-spin' : ''}`} />
                Refresh Events
              </Button>
            </div>

            {isLoadingEvents && recentEvents.length === 0 ? (
              <div className="flex justify-center py-6">
                <Loading size="md" />
              </div>
            ) : recentEvents.length === 0 ? (
              <p className="text-center py-6 text-xs text-zinc-500">
                No observations recorded yet. Be the first participant to submit a price!
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 uppercase text-[10px] text-left">
                      <th className="py-2 px-3">Participant</th>
                      <th className="py-2 px-3">Price</th>
                      <th className="py-2 px-3">Weight</th>
                      <th className="py-2 px-3">Time</th>
                      <th className="py-2 px-3 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                    {recentEvents.map((evt, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-zinc-700 dark:text-zinc-300">
                          {evt.submitter.slice(0, 6)}…{evt.submitter.slice(-4)}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-900 dark:text-zinc-100 font-bold">
                          {fmt(evt.price)}
                        </td>
                        <td className="py-2.5 px-3 text-violet-600 dark:text-violet-400">
                          {fmt(evt.weight)}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-500 font-sans">
                          {timeAgo(evt.timestamp)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-sans">
                          {evt.txHash ? (
                            <a
                              href={getExplorerTxLink(evt.txHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-violet-500 hover:text-violet-700 inline-flex items-center gap-0.5"
                            >
                              Tx <ExternalLink size={10} />
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Educational Guide Card ── */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 md:p-8 space-y-5 shadow-sm">
          <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Scale size={18} className="text-violet-500" />
            How Karma Prevents Oracle Manipulation
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1.5 border border-zinc-100 dark:border-zinc-800">
              <strong className="text-zinc-900 dark:text-zinc-200 block text-sm">
                1. Economic Neutrality Weighting
              </strong>
              <p>
                A participant holding only Bull coins wants the price to rise; holding only Bear coins wants it to fall. Neither can be trusted. Karma weights participants by the minimum of their opposing positions. Only neutral market holders possess voting weight.
              </p>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1.5 border border-zinc-100 dark:border-zinc-800">
              <strong className="text-zinc-900 dark:text-zinc-200 block text-sm">
                2. Exponential Time Decay (τ)
              </strong>
              <p>
                Price observations decay exponentially over time according to τ (tau = 124,651 seconds, ~34.6 hours). This continuous decay ensures the consensus rapidly reflects modern reality without accumulating stale historical inputs.
              </p>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1.5 border border-zinc-100 dark:border-zinc-800">
              <strong className="text-zinc-900 dark:text-zinc-200 block text-sm">
                3. Flash Loan & Sybil Resistance
              </strong>
              <p>
                Manipulating the oracle requires purchasing both Bull and Bear coins in balanced amounts. Karma pools collect trading fees (~1.2% round-trip) on every trade, making manipulation economically irrational and unprofitable.
              </p>
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-1.5 border border-zinc-100 dark:border-zinc-800">
              <strong className="text-zinc-900 dark:text-zinc-200 block text-sm">
                4. Self-Sovereign & Ownerless
              </strong>
              <p>
                Karma contracts have no admin keys, no owner, and no off-chain dependencies. All calculations occur deterministically on-chain, accessible via standard IOracle and Chainlink-compatible feeds.
              </p>
            </div>
          </div>
        </div>

      </div>

      <WalletLinkModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
    </div>
  );
}

function tryParseWad(val: string): string {
  try {
    return parseUnits(val.trim(), 18).toString();
  } catch {
    return '…';
  }
}
