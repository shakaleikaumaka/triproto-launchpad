/* ═══ CHAINLENS — zero-build on-chain reader for the Act II pages ═══
   Reads a leg (registry cohort + GiftMarket counters + GiftSent/BlessingSent events)
   straight from a public RPC with the vendored ethers v6. READ-ONLY: this module never
   holds keys and never sends transactions (CROPS law — pages hold no keys, ever).
   Used by web/triforce (living triangles) and web/altar (live cohort + on-chain ledger). */
import { JsonRpcProvider, Contract, formatEther } from "../vendor/ethers-6.15.0.min.js";

const REG_ABI = [
  "function totalAgents() view returns (uint256)",
  "function getAgent(uint256 agentId) view returns (address operator, string manifestURI, bytes32 manifestHash, string serviceEndpoint, string ensLabel, bytes32 ensNode, uint256 ensTokenId, uint8 consent, bool listed, uint64 launchedAt, uint64 expiry)"
];
const GM_ABI = [
  "function totalGifts() view returns (uint256)",
  "function totalBlessings() view returns (uint256)",
  "function totalHires() view returns (uint256)",
  "event GiftSent(uint256 indexed giftId, uint8 indexed kind, uint256 indexed agentId, address from, address to, uint256 amount, string message, string dedication)",
  "event BlessingSent(uint256 indexed blessingId, uint8 indexed kind, uint256 indexed agentId, address from, address to, uint256 amount, string message)"
];
const CONSENT = ["active", "paused", "withdrawn"];

export function makeProvider(cfg) {
  return new JsonRpcProvider(cfg.rpc, cfg.chainId, { staticNetwork: true });
}

/* history cache: event queries hit the (rate-limited) logsRpc only when the
   market counters actually move — pollers can refresh cheaply forever */
const HIST = new Map(); // `${chainId}:${giftMarket}` → { key, events }

/* read one leg: { name, chainId, explorer, totalAgents, agents[], market{gifts,blessings,hires}, events[], lastEventAt } */
export async function readLeg(cfg, opts = {}) {
  if (!cfg || !cfg.rpc || !cfg.registry) return null;
  const provider = opts.provider || makeProvider(cfg);
  const reg = new Contract(cfg.registry, REG_ABI, provider);
  const total = Number(await reg.totalAgents());
  const ids = [];
  for (let id = 1; id <= Math.min(total, 36); id++) ids.push(id);
  const agents = (await Promise.all(ids.map(async id => {
    try {
      const a = await reg.getAgent(id);
      return {
        agentId: String(id),
        label: a.ensLabel || ("#" + id),
        consentStatus: CONSENT[Number(a.consent)] || "unknown",
        listed: a.listed,
        launchedAt: String(a.launchedAt)
      };
    } catch (e) { return null; }
  }))).filter(Boolean);

  let market = null, events = [];
  if (cfg.giftMarket) {
    const gm = new Contract(cfg.giftMarket, GM_ABI, provider);
    const [g, b, h] = await Promise.all([gm.totalGifts(), gm.totalBlessings(), gm.totalHires()]);
    market = { gifts: Number(g), blessings: Number(b), hires: Number(h) };
    const histKey = `${market.gifts}/${market.blessings}`;
    const cacheId = `${cfg.chainId}:${cfg.giftMarket}`;
    const cached = HIST.get(cacheId);
    if (cached && cached.key === histKey) {
      events = cached.events;
    } else try {
      /* history goes through logsRpc when set — some public gateways (publicnode
         Sepolia) prune getLogs to a ~10k-block horizon, others rate-limit hard */
      const histProvider = cfg.logsRpc ? new JsonRpcProvider(cfg.logsRpc, cfg.chainId, { staticNetwork: true }) : provider;
      const gmHist = new Contract(cfg.giftMarket, GM_ABI, histProvider);
      const from = cfg.giftMarketBlock || 0;
      let gl, bl;
      try {
        [gl, bl] = await Promise.all([gmHist.queryFilter("GiftSent", from), gmHist.queryFilter("BlessingSent", from)]);
      } catch (e) { // some public RPCs cap getLogs ranges — fall back to a recent window
        const latest = await histProvider.getBlockNumber();
        const recent = Math.max(from, latest - 40000);
        [gl, bl] = await Promise.all([gmHist.queryFilter("GiftSent", recent), gmHist.queryFilter("BlessingSent", recent)]);
      }
      const blockTs = new Map();
      const tsOf = async ev => {
        if (!blockTs.has(ev.blockNumber)) blockTs.set(ev.blockNumber, (await histProvider.getBlock(ev.blockNumber)).timestamp);
        return blockTs.get(ev.blockNumber);
      };
      const byId = new Map(agents.map(a => [a.agentId, a.label]));
      const who = ev => {
        const aid = ev.args.agentId?.toString();
        return (aid && aid !== "0") ? (byId.get(aid) || ("agent #" + aid)) : (String(ev.args.to).slice(0, 8) + "…");
      };
      for (const ev of gl) events.push({
        type: "gift", ic: "🎁", chain: cfg.name, tx: ev.transactionHash, ts: (await tsOf(ev)) * 1000,
        txt: `gift for ${who(ev)} (${formatEther(ev.args.amount)} ETH)` +
             (ev.args.message ? ` — “${ev.args.message}”` : "") +
             (ev.args.dedication ? ` · ${ev.args.dedication}` : "")
      });
      for (const ev of bl) events.push({
        type: "blessing", ic: "🌺", chain: cfg.name, tx: ev.transactionHash, ts: (await tsOf(ev)) * 1000,
        txt: `blessing for ${who(ev)} (${formatEther(ev.args.amount)} ETH)` +
             (ev.args.message ? ` — “${ev.args.message}”` : "")
      });
      events.sort((a, b) => b.ts - a.ts);
      HIST.set(cacheId, { key: histKey, events });
    } catch (e) { /* counters still stand; events feed is best-effort */ }
  }
  return {
    name: cfg.name, chainId: cfg.chainId, explorer: cfg.explorer,
    totalAgents: total, agents, market, events,
    lastEventAt: events.length ? Math.floor(events[0].ts / 1000) : null
  };
}
