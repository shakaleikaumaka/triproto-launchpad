/* ═══ DEPLOYMENTS — the single wiring point between Act I (contracts) and Act II (triforce frontend) ═══
   Act I landed: Sepolia + Base Sepolia legs are LIVE (addresses below mirror
   contracts/deployments/<chainId>*.json — keep both in sync).
   Every Act II page reads this file and gracefully falls back to clearly-labeled MOCK mode
   while a value is null. No secrets here — public addresses + public query endpoints only. */
window.OHANA_DEPLOYMENTS = {
  /* one Pulse, many legs: comma-merge pattern identical to web/pulse */
  subgraphEndpoints: [
    "https://api.studio.thegraph.com/query/1760239/my-agent-ohana/v0.0.1" // Sepolia leg — LIVE
    // subgraph task 4: add Base-Sepolia + BSC-testnet legs here when the subgraph indexes them
  ],
  subgraphApiKey: "ab23adecd20fb599f7cc4953375c69a7", // public query key (client-safe, rate-limited to the pad)
  familyName: "agentohana.eth",

  sepolia: {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    explorer: "https://sepolia.etherscan.io",
    rpc: "https://ethereum-sepolia-rpc.publicnode.com", // calls (counters/cohort) — generous limits
    /* SCAR: publicnode's Sepolia gateway prunes eth_getLogs to a ~10k-block horizon
       (~33h) — history reads silently return []. Tenderly serves full history but
       rate-limits hard, so it's used ONLY for event history (cached in chainlens,
       re-queried when the market counters move). */
    logsRpc: "https://sepolia.gateway.tenderly.co",
    registry: "0x62412fcA6437b914EDD87b85455682Ec73968347", // AgentLaunchRegistry — LIVE
    registryBlock: 11692692,
    giftMarket: "0x4Cbc337c8F63FFc0e8e96D5F5ea89A75eD31E575", // GiftMarket — LIVE (Act I)
    giftMarketBlock: 11704971
  },
  baseSepolia: {
    chainId: 84532,
    name: "Base Sepolia",
    explorer: "https://sepolia.basescan.org",
    rpc: "https://sepolia.base.org", // official Base testnet RPC (no key, full history)
    registry: "0xAfd78515B0Ef275595547d9Cc0207aE326bd8a34",   // AgentLaunchRegistry — LIVE (Act I)
    registryBlock: 46823445,
    giftMarket: "0x24B55471bB1d5Ab29D1D24f102dce6a6a5851937", // GiftMarket — LIVE (Act I)
    giftMarketBlock: 46823450
  },
  bscTestnet: {
    chainId: 97,
    name: "BNB Testnet",
    explorer: "https://testnet.bscscan.com",
    curve: null // honest null — Agent Launch HAS a chainId-97 testnet; faucet needs an
                // Agentverse API key (human step). The BNB triangle stays "awaiting its leg".
  },

  /* Ceremony Hall living-flame source. When the BSC-testnet curve is live, act1 sets
     ceremony.curveAddress + the flame reads raisedFET on-chain / via subgraph.
     While null → Ceremony Hall runs in clearly-labeled REHEARSAL mode. */
  ceremony: {
    goalFET: 30000,     // graduation threshold (1B supply / 800M curve / 200M DEX reserve canon)
    raisedFET: null,    // still rehearsal — flips live with the BNB curve
    curveAddress: null
  }
};
