/* ═══ DEPLOYMENTS — the single wiring point between Act I (contracts) and Act II (triforce frontend) ═══
   Lane act1: when the GiftMarket / Base-Sepolia / BSC-testnet legs land, fill the addresses below
   (mirror of contracts/deployments/<chainId>.json — keep both in sync).
   Every Act II page reads this file and gracefully falls back to clearly-labeled MOCK mode
   while a value is null. No secrets here — public addresses + public query endpoints only. */
window.OHANA_DEPLOYMENTS = {
  /* one Pulse, many legs: comma-merge pattern identical to web/pulse */
  subgraphEndpoints: [
    "https://api.studio.thegraph.com/query/1760239/my-agent-ohana/v0.0.1" // Sepolia leg — LIVE
    // act1 task 4: add Base-Sepolia + BSC-testnet legs here when the subgraph indexes them
  ],
  subgraphApiKey: "ab23adecd20fb599f7cc4953375c69a7", // public query key (client-safe, rate-limited to the pad)
  familyName: "agentohana.eth",

  sepolia: {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    explorer: "https://sepolia.etherscan.io",
    registry: "0x62412fcA6437b914EDD87b85455682Ec73968347", // AgentLaunchRegistry — LIVE
    giftMarket: null // ← act1 task 1 publishes the GiftMarket address here
  },
  baseSepolia: {
    chainId: 84532,
    name: "Base Sepolia",
    explorer: "https://sepolia.basescan.org",
    registry: null,   // ← act1 task 2 (dual-mode deploy script)
    giftMarket: null
  },
  bscTestnet: {
    chainId: 97,
    name: "BNB Testnet",
    explorer: "https://testnet.bscscan.com",
    curve: null       // ← act1 task 3 (Agent Launch testnet or faithful mock bonding curve)
  },

  /* Ceremony Hall living-flame source. When the BSC-testnet curve is live, act1 sets
     ceremony.curveAddress + the flame reads raisedFET on-chain / via subgraph.
     While null → Ceremony Hall runs in clearly-labeled REHEARSAL mode. */
  ceremony: {
    goalFET: 30000,     // graduation threshold (1B supply / 800M curve / 200M DEX reserve canon)
    raisedFET: null,    // ← act1: live number, or leave null for rehearsal flame
    curveAddress: null
  }
};
