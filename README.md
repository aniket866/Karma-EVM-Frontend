<!-- Don't delete it -->
<div name="readme-top"></div>

<!-- Organization Logo -->
<div align="center" style="display: flex; align-items: center; justify-content: center; gap: 16px;">
  <img alt="Stability Nexus" src="public/Animated/logo-animated.gif" width="175">
  <img alt="Karma Protocol bull and bear logo" src="public/logo.png" width="150">
</div>

&nbsp;

<!-- Organization Name -->
<div align="center">

[![Static Badge](https://img.shields.io/badge/Stability_Nexus-KarmaProtocol-d97706?style=for-the-badge&labelColor=1c1917)](https://evm.karma.stability.nexus/)

</div>

<!-- Organization/Project Social Handles -->
<p align="center">
<!-- Telegram -->
<a href="https://t.me/StabilityNexus">
<img src="https://img.shields.io/badge/Telegram-black?style=flat&logo=telegram&logoColor=white&logoSize=auto&color=24A1DE" alt="Telegram Badge"/></a>
&nbsp;&nbsp;
<!-- X (formerly Twitter) -->
<a href="https://x.com/StabilityNexus">
<img src="https://img.shields.io/twitter/follow/StabilityNexus" alt="X (formerly Twitter) Badge"/></a>
&nbsp;&nbsp;
<!-- Discord -->
<a href="https://discord.gg/YzDKeEfWtS">
<img src="https://img.shields.io/discord/995968619034984528?style=flat&logo=discord&logoColor=white&logoSize=auto&label=Discord&labelColor=5865F2&color=57F287" alt="Discord Badge"/></a>
&nbsp;&nbsp;
<!-- Medium -->
<a href="https://news.stability.nexus/">
  <img src="https://img.shields.io/badge/Medium-black?style=flat&logo=medium&logoColor=black&logoSize=auto&color=white" alt="Medium Badge"></a>
&nbsp;&nbsp;
<!-- LinkedIn -->
<a href="https://linkedin.com/company/stability-nexus">
  <img src="https://img.shields.io/badge/LinkedIn-black?style=flat&logo=LinkedIn&logoColor=white&logoSize=auto&color=0A66C2" alt="LinkedIn Badge"></a>
&nbsp;&nbsp;
<!-- Youtube -->
<a href="https://www.youtube.com/@StabilityNexus">
  <img src="https://img.shields.io/youtube/channel/subscribers/UCZOG4YhFQdlGaLugr_e5BKw?style=flat&logo=youtube&logoColor=white&logoSize=auto&labelColor=FF0000&color=FF0000" alt="Youtube Badge"></a>
</p>

---

<div align="center">
<h1>Karma Protocol</h1>
</div>

[Karma Protocol](https://evm.karma.stability.nexus/) is a permissionless on-chain oracle and perpetual prediction market platform. It weights submitted price observations by participants' opposing Bull and Bear exposure.

Built with cutting-edge Web3 technologies, Karma Protocol delivers high-performance trading experiences with gas-optimized smart contracts and real-time community price discovery.

## ✨ Key Features

-  **Neutrality-Weighted Consensus**: Voting power is determined on-chain by `min(Bull, Bear)` holdings—one-sided speculators have zero influence
-  **Exponential Time Decay**: Price observations decay smoothly over time, keeping the oracle responsive to fresh market conditions
-  **Perpetual Market**: Continuous trading without expiration dates; enter and exit positions at any time
-  **Mainnet Wallet Support**: Ethereum Mainnet and Base Mainnet are available in wallet and explorer configuration
-  **Chainlink-Compatible Interface**: Seamless drop-in replacement for standard `AggregatorV3Interface` consumers
-  **Client-Side IndexedDB Caching**: Fast and responsive offline-first portfolio and pool browsing

## Launch Configuration

Ethereum Mainnet and Base Mainnet do not yet have verified Karma factory addresses configured in this repository. Base Mainnet Chainlink options are available, but pool creation and Karma-oracle deployment stay disabled until the required factories are deployed and their verified addresses are added. Add the deployment block as well so portfolio history can scan from the right point.

---

## Technical Architecture

### Frontend

- **Next.js 15 (App Router)**: Server-side rendering, dynamic routes, and fast static delivery
- **TypeScript & React 19**: Strictly typed components and state management
- **Tailwind CSS**: Custom Amber/Gold/Emerald theme with glassmorphic aesthetics
- **Wagmi & Viem**: EVM interactions, multicalls, event log indexing, and wallet connectivity
- **IndexedDB**: Persistent local storage for user trade history and cached pool details

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm / pnpm / yarn
- Web3 wallet extension (e.g. MetaMask, Coinbase Wallet, Rabby)

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/StabilityNexus/Karma-EVM-Frontend.git
cd Karma-EVM-Frontend
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Run the Development Server

```bash
npm run dev
```

#### 4. Open your Browser

Navigate to [http://localhost:3000](http://localhost:3000) to view the application.

---

## Project Structure

```text
src/
├── app/
│   ├── [pool]/            # Pool interactions & Karma Consensus Power
│   ├── createPool/        # Karma pool creation
│   ├── explorePools/      # Pool discovery & filtering
│   ├── portfolio/         # User portfolio & trade history
│   ├── settings/          # Cache management & backup export/import
│   ├── submitPrice/       # Price observation submissions & consensus
│   ├── globals.css        # Theme styles & animations (standard smooth cursor)
│   ├── layout.tsx         # Root layout with Navbar and providers
│   └── page.tsx           # Home landing page with dynamic Hero & About
├── components/            # Reusable UI components
│   ├── Explore/           # Pool exploration & table/grid views
│   ├── Forms/             # CreateKarmaPool and multi-step configuration
│   ├── Home/              # Hero, protocol architecture, and feature cards
│   ├── KarmaPoolCard/     # PredictionCard & RangeSlider
│   ├── Portfolio/         # TradeHistoryCard & position analytics
│   ├── layout/            # Navbar, Footer, and Navigation
│   └── ui/                # Base UI components (buttons, dialogs, inputs)
├── hooks/                 # React hooks (useIndexedDB)
├── lib/                   # Utilities (karmaPoolHook, scanLogs, estimateBuy/Sell)
└── utils/                 # Configuration (addresses, chainConfig, ABIs)
```

---

## Building and Testing

```bash
# Run unit and validation test suites
npm test

# Build production bundle
npm run build
```

## Contributing

We welcome contributions of all kinds. Questions and ideas are welcome in our [Discord channel](https://discord.gg/YzDKeEfWtS).

© 2026 The Stable Order.
