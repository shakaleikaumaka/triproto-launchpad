/**
 * preflight.mjs — read-only BSC pre-flight checks (CROPS gates ③ and ⑥).
 *
 * Uses public JSON-RPC eth_call only. No key material is touched here.
 * Runnable standalone: `npm run preflight` (or as a library from deploy-cohort).
 */
import { CHAIN_CONFIGS } from "@fetchai/agent-launch-sdk";

export const FET_ADDRESS = CHAIN_CONFIGS[56].fetAddress; // BSC mainnet FET (BEP-20)
export const DEPLOYER_CONTRACT = CHAIN_CONFIGS[56].deployerAddress; // platform deployer
export const BSC_CHAIN_ID = 56;

const RPCS = [
  process.env.BSC_RPC || "https://bsc.publicnode.com",
  "https://rpc.ankr.com/bsc",
  "https://bsc-dataseed1.binance.org",
];

const padAddr = (a) => a.toLowerCase().replace("0x", "").padStart(64, "0");

async function rpc(method, params) {
  let lastErr;
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const j = await res.json();
      if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
      return { result: j.result, rpc: url };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`All BSC RPCs failed: ${lastErr?.message}`);
}

export async function preflight(deployerAddress) {
  // Gate ⑥: chain MUST be BSC mainnet (56)
  const chain = await rpc("eth_chainId", []);
  const chainId = parseInt(chain.result, 16);
  if (chainId !== BSC_CHAIN_ID) {
    throw new Error(
      `CROPS gate ⑥: RPC reports chainId ${chainId}, expected ${BSC_CHAIN_ID} — refusing to continue.`
    );
  }

  const out = { chainId, rpc: chain.rpc, deployer: deployerAddress };

  if (!deployerAddress) {
    out.ok = false;
    out.error = "No deployer address resolved (set DEPLOYER_ADDRESS or FET_DEPLOYER_KEY)";
    return out;
  }

  // FET balance via ERC-20 balanceOf (read-only eth_call)
  const fet = await rpc("eth_call", [
    { to: FET_ADDRESS, data: "0x70a08231" + padAddr(deployerAddress) },
    "latest",
  ]);
  out.fetBalance = Number(BigInt(fet.result)) / 1e18;

  // BNB gas balance
  const bnb = await rpc("eth_getBalance", [deployerAddress, "latest"]);
  out.bnbBalance = Number(BigInt(bnb.result)) / 1e18;

  out.ok = true;
  return out;
}

// Standalone run
if (import.meta.url === `file://${process.argv[1]}`) {
  const addr = process.env.DEPLOYER_ADDRESS;
  try {
    const r = await preflight(addr);
    console.log(JSON.stringify(r, null, 2));
    if (!r.ok) process.exit(1);
  } catch (e) {
    console.error(`PREFLIGHT FAILED: ${e.message}`);
    process.exit(1);
  }
}
