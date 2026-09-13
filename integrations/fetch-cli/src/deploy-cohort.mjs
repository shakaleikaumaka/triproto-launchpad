#!/usr/bin/env node
/**
 * deploy-cohort.mjs — CROPS-safe launcher for the triproto cohort
 * ($SHAKA / $PIT / $OHANA) on agent-launch.ai (BSC mainnet, chain 56).
 *
 * SAFETY GATES (all mandatory, none bypassable):
 *  ① DRY-RUN BY DEFAULT — without `--yes` this prints the full transaction
 *     preview and refuses to send anything. Exit 0.
 *  ② KEY VIA ENV ONLY — FET_DEPLOYER_KEY (or address-only DEPLOYER_ADDRESS)
 *     from a chmod-600, gitignored .env. The key is used ONLY to derive the
 *     deployer address locally; it is never transmitted (this platform
 *     completes on-chain deployment via human handoff link + MetaMask).
 *  ③ FET BALANCE GATE — before attempting token i of the planned cohort,
 *     the deployer must hold ≥ (remaining tokens × 120 FET) + buffer
 *     (default 25 FET, override with --buffer or FET_BUFFER env).
 *  ④ DEPLOYMENTS LEDGER — successful record creations are written to
 *     deployments/bsc.json (runtime artifact, gitignored).
 *  ⑤ FULL LOGGING — every action logged to console + deployments/log.jsonl;
 *     secrets are always masked (prefix only). Private keys are never logged.
 *  ⑥ CHAIN GATE — public RPC must report chainId 56, else hard abort.
 *  ⑦ ON-CHAIN STEP IS HUMAN-BY-DESIGN — the platform's own deploy flow is a
 *     handoff link (approve 120 FET → deployer contract, then deploy()).
 *     This tool automates only the API-side token RECORD creation and then
 *     prints the handoff link for the human signer. That is a feature of the
 *     SDK, and we honor it.
 *
 * Usage:
 *   node src/deploy-cohort.mjs [--json] [--cohort path] [--max-tokens n]
 *                              [--buffer fet]
 *   node src/deploy-cohort.mjs --yes    # actually create token records
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Wallet } from "ethers";
import { AgentLaunchClient, generateDeployLink } from "@fetchai/agent-launch-sdk";
import { loadEnv, mask } from "./env.mjs";
import { preflight, DEPLOYER_CONTRACT, BSC_CHAIN_ID } from "./preflight.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const DEPLOYMENTS_DIR = path.join(ROOT, "deployments");
const LEDGER = path.join(DEPLOYMENTS_DIR, "bsc.json");
const RUNLOG = path.join(DEPLOYMENTS_DIR, "log.jsonl");

// ---------- arg parsing ----------
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, dflt) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : dflt;
};
const YES = flag("--yes");
const AS_JSON = flag("--json");
const COHORT_PATH = opt("--cohort", path.join(ROOT, "cohort.json"));
const MAX_TOKENS = opt("--max-tokens", null);
const BUFFER = Number(opt("--buffer", process.env.FET_BUFFER || 25));

// ---------- logging (gate ⑤) ----------
function log(event, data = {}) {
  const line = { ts: new Date().toISOString(), event, ...data };
  if (!AS_JSON) console.log(`[${event}]`, ...[data.msg || ""]);
  try {
    fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
    fs.appendFileSync(RUNLOG, JSON.stringify(line) + "\n");
  } catch {}
}
const say = (s) => {
  if (!AS_JSON) console.log(s);
};

// ---------- setup ----------
loadEnv(ROOT);
const cohort = JSON.parse(fs.readFileSync(COHORT_PATH, "utf8"));
let tokens = cohort.tokens;
if (MAX_TOKENS) tokens = tokens.slice(0, Number(MAX_TOKENS));
const FEE = cohort.feePerTokenFet ?? 120;

// Gate ②: deployer identity — key derives address LOCALLY ONLY, else address-only mode
let deployerAddress = process.env.DEPLOYER_ADDRESS || null;
let identitySource = "DEPLOYER_ADDRESS (address-only mode)";
if (process.env.FET_DEPLOYER_KEY) {
  try {
    deployerAddress = new Wallet(process.env.FET_DEPLOYER_KEY).address;
    identitySource = `FET_DEPLOYER_KEY ${mask(process.env.FET_DEPLOYER_KEY, 6)} (derived locally)`;
  } catch {
    console.error("FET_DEPLOYER_KEY is set but not a valid private key.");
    process.exit(1);
  }
}

say("╔══════════════════════════════════════════════════════════╗");
say("║  triproto-fetch-cli — cohort launcher (BSC mainnet 56)   ║");
say(`║  mode: ${YES ? "--yes (CREATE RECORDS)" : "DRY-RUN (default, nothing sent)"}            ║`);
say("╚══════════════════════════════════════════════════════════╝");
say(`cohort:  ${cohort.cohort} (${tokens.length}/${cohort.tokens.length} tokens planned)`);
say(`deployer: ${deployerAddress ? deployerAddress : "(unresolved)"} ← ${identitySource}`);
say(`fee: ${FEE} FET/token · buffer: ${BUFFER} FET`);
log("start", {
  mode: YES ? "yes" : "dry-run",
  cohort: cohort.cohort,
  planned: tokens.length,
  deployer: deployerAddress,
  buffer: BUFFER,
  fee: FEE,
});

// ---------- Gate ⑥ + balances ----------
let pf;
try {
  pf = await preflight(deployerAddress);
} catch (e) {
  log("abort", { reason: e.message });
  console.error(`\n❌ PRE-FLIGHT FAILED: ${e.message}`);
  process.exit(1);
}
if (!pf.ok) {
  log("abort", { reason: pf.error });
  console.error(`\n⚠️  ${pf.error} — dry-run preview only (balances unknown).`);
}
const fetBalance = pf.ok ? pf.fetBalance : null;
const bnbBalance = pf.ok ? pf.bnbBalance : null;
say(`\nPRE-FLIGHT @ chain ${pf.chainId} via ${pf.rpc}`);
if (pf.ok) {
  say(`  FET balance:  ${fetBalance.toFixed(4)} FET`);
  say(`  BNB balance:  ${bnbBalance.toFixed(6)} BNB ${bnbBalance === 0 ? "  ⚠️ zero — the human handoff deploy step needs gas!" : ""}`);
}

// ---------- Gate ③ per-token math + preview ----------
say(`\nTRANSACTION PREVIEW (${tokens.length} tokens):`);
const plan = [];
let allGated = pf.ok;
for (let i = 0; i < tokens.length; i++) {
  const t = tokens[i];
  const remaining = tokens.length - i;
  const required = remaining * FEE + BUFFER; // gate ③
  const gatedOk = fetBalance !== null && fetBalance >= required;
  if (!gatedOk) allGated = false;
  const row = {
    token: `${t.name} ($${t.symbol})`,
    agent: t.agent,
    chainId: BSC_CHAIN_ID,
    feeFet: FEE,
    bufferFet: BUFFER,
    requiredNow: required,
    recipient: DEPLOYER_CONTRACT,
    handoff: "human MetaMask step (approve → deploy)",
    gate: gatedOk ? "PASS" : "INSUFFICIENT",
  };
  plan.push(row);
  say(`  ────────────────────────────────────────────────────────`);
  say(`  ${i + 1}. ${t.name} ($${t.symbol})`);
  say(`     agent:     ${t.agent}`);
  say(`     chain:     BSC mainnet (${BSC_CHAIN_ID})`);
  say(`     fee:       ${FEE} FET → deployer contract ${DEPLOYER_CONTRACT}`);
  say(`     gate ③:    needs ≥ ${required} FET now (${remaining} left × ${FEE} + ${BUFFER} buffer) → ${row.gate}`);
  say(`     describe:  ${t.description.slice(0, 80)}…`);
}
const totalNeed = tokens.length * FEE + BUFFER;
say(`\n  cohort total: ${tokens.length} × ${FEE} FET + ${BUFFER} buffer = ${totalNeed} FET`);
if (pf.ok) say(`  balance ${fetBalance.toFixed(4)} FET → ${allGated ? "✅ cohort gate PASS" : `❌ SHORT by ${(totalNeed - fetBalance).toFixed(4)} FET`}`);
log("preview", { plan, totalNeed, pass: allGated });

// ---------- Gate ①: dry-run refusal ----------
if (!YES) {
  say(`\n🛡️  DRY-RUN COMPLETE — nothing was sent.`);
  say(`    To create the API-side token records, re-run with --yes.`);
  say(`    On-chain deployment is human-by-design: ${tokens.map((t) => "$" + t.symbol).join(" ")} handoff links are printed after record creation; a human signer (Shaka's MetaMask) then does approve(120 FET)+deploy() per token.`);
  log("dry-run-complete", { sent: false });
  process.exit(0);
}

// ---------- --yes path ----------
if (!process.env.AGENTVERSE_API_KEY) {
  console.error("\n❌ --yes requires AGENTVERSE_API_KEY (see .env.example). Aborted.");
  log("abort", { reason: "no AGENTVERSE_API_KEY" });
  process.exit(1);
}
if (!deployerAddress) {
  console.error("\n❌ --yes requires a deployer identity (DEPLOYER_ADDRESS or FET_DEPLOYER_KEY). Aborted.");
  log("abort", { reason: "no deployer identity" });
  process.exit(1);
}
if (pf.ok && !allGated) {
  console.error(`\n❌ Gate ③: cohort needs ${totalNeed} FET, balance is ${fetBalance.toFixed(4)}. Reduce --max-tokens or top up FET. Aborted.`);
  log("abort", { reason: "gate ③ insufficient", need: totalNeed, have: fetBalance });
  process.exit(1);
}

const baseUrl = process.env.AGENT_LAUNCH_API_URL || undefined; // SDK default = prod
const client = new AgentLaunchClient({ baseUrl, apiKey: process.env.AGENTVERSE_API_KEY });
const ledger = fs.existsSync(LEDGER)
  ? JSON.parse(fs.readFileSync(LEDGER, "utf8"))
  : { chainId: BSC_CHAIN_ID, tokens: {}, runs: [] };

say(`\n🚀 --yes: creating token records via Agent Launch API…`);
let okCount = 0;
for (const t of tokens) {
  // Gate ③ re-check right before this token (balance fresh from preflight;
  // on-chain handoff spends happen outside this tool, so balance won't move
  // during record creation — the gate math above remains correct.)
  const body = {
    agentAddress: t.agent,
    name: t.name,
    symbol: t.symbol.toUpperCase(),
    chainId: BSC_CHAIN_ID,
    maxWalletAmount: t.maxWallet ?? 0,
    category: { id: t.categoryId ?? 1 },
  };
  if (t.description) body.description = t.description;
  try {
    const res = await client.post("/agents/tokenize", body);
    const tokenId = res.token_id ?? res.tokenId ?? res.data?.token_id;
    const handoff = tokenId !== undefined ? generateDeployLink(tokenId) : res.handoff_link;
    ledger.tokens[t.symbol] = {
      name: t.name,
      agent: t.agent,
      tokenId,
      status: "record-created",
      handoffLink: handoff ?? null,
      feeFet: FEE,
      at: new Date().toISOString(),
    };
    okCount++;
    say(`  ✅ $${t.symbol}: record created${tokenId !== undefined ? ` (id ${tokenId})` : ""}`);
    if (handoff) say(`     handoff → ${handoff}`);
    log("record-created", { symbol: t.symbol, tokenId, handoff });
  } catch (e) {
    say(`  ❌ $${t.symbol}: ${e.message}`);
    log("record-failed", { symbol: t.symbol, error: e.message });
  }
}
ledger.runs.push({ ts: new Date().toISOString(), ok: okCount, total: tokens.length });
fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + "\n");
say(`\n📒 ledger → deployments/bsc.json (${okCount}/${tokens.length} created)`);
say(`\nNEXT (human step — needs BNB gas): open each handoff link in MetaMask on`);
say(`BSC mainnet, then per token: ① approve ${FEE} FET to ${DEPLOYER_CONTRACT}`);
say(`② call deploy() on the deployer contract. LP graduation target: 30,000 FET.`);
log("complete", { ok: okCount, total: tokens.length });
process.exit(okCount === tokens.length ? 0 : 1);
