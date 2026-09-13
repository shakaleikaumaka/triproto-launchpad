# CROPS-REVIEW — Lane SDK (`integrations/fetch-cli/**`, `docs/fetch-cli.md`)

**Verdict: MINOR** — ship it after the two MINOR hygiene fixes below. Nothing blocks the
dry-run or the human-handoff ceremony; nothing endangers keys, funds, or consent.

- Reviewed branch/commit: `lane/sdk` @ `75ccd09` (sole lane commit, tree scanned in full)
- Reviewer: CROPS review lane (independent of lane/sdk author), 2026-09-13
- Method: full read of all 11 lane files + adversarial execution (live dry-runs, abort-path
  tests, wrong-chain RPC test, key-masking probe) + independent ground-truth checks
  (npm registry integrity, SDK tarball contents, BscScan/web verification of contract
  addresses, `uagents` re-derivation of all three agentverse identities).

## Checklist verdicts

| # | Gate | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Never logs/commits private keys; `.gitignore` covers `.env`/`.env.*` | **PASS** | `.gitignore` has `.env`, `.env.*`, `!.env.example`, plus `deployments/*.json(l)`. Full-tree 64-hex scan: only pre-existing forge-std fixtures (main, unrelated). Live probe with a throwaway key: full key appears **0 times** in console and `deployments/log.jsonl` — only `0xac09…[masked len 66]` (prefix-6 masking). `.env.example` ships `FET_DEPLOYER_KEY=` empty. chmod-644 `.env` triggers a loud warning. |
| 2 | Dry-run gate (default NO spend; `--yes` required) | **PASS** | Default run prints full preview and exits 0 sending nothing. `--yes` additionally requires `AGENTVERSE_API_KEY`, a resolved deployer identity, and gate ③ pass (each abort = exit 1, all live-tested). Defense in depth: even `--yes` only creates the API-side token *record*; the irreversible on-chain spend is a human MetaMask handoff (gate ⑦) — the tool never broadcasts a transaction. |
| 3 | chain-id=56 enforced + balance ≥ fee + ~20% | **PASS** | `eth_chainId` must equal 56, hard abort otherwise — live-tested with an Ethereum-mainnet RPC (`chainId 1`): `PRE-FLIGHT FAILED … refusing to continue`, exit 1. Chain id is hardcoded in the request body (config can't override). Balance gate: `remaining × 120 FET + 25 FET buffer` — 25/120 = **20.8% headroom** on the marginal token, i.e. fee + ~20% as required; `--buffer`/`FET_BUFFER` adjustable. NaN/garbage buffer fails closed (gate → INSUFFICIENT → `--yes` aborts). |
| 4 | `FET_DEPLOYER_KEY` env handling | **PASS** | Used **only locally** to derive the deployer address via ethers; never transmitted (record creation is API-key authed; on-chain step is human). Masked prefix-only in console, never written to the log file. Address-only mode (`DEPLOYER_ADDRESS`) needs no key material at all. No real key anywhere in repo, docs, or README. |
| 5 | CLI pinned `@fetchai/agent-launch-cli@2.0.1` (not scambait) | **PASS** | `package.json` exact-pins cli `2.0.1`, sdk `0.3.0`, ethers `6.13.4` (no ranges). Lockfile `resolved` URLs all `registry.npmjs.org` and `resolved`+`integrity` **match the live registry exactly** for all three — no typosquat/substitution. Provenance independently confirmed: maintainers include `ejfitzgerald@`/`efitzgerald@`/`devon.bleibtrey@fetch.ai` and `robin@`/`artashes@vbrl.ai`; 2.0.0→2.0.1 = April 2026 patch, repo `fetchai/agent-launch-toolkit`, MIT. |
| 6 | Dry-run tx destination sanity | **PASS** | Live dry-run: chain 56 via public RPC · fee **120 FET** · recipient `0xeDecbC8E118288e1365Db14c9c2f3d51E91Cc247` = the pinned SDK's own `CHAIN_CONFIGS[56].deployerAddress` (read from the installed tarball). FET token `0x031b41e504677879370e9DBcF937283A8691Fa7f` independently web-verified as the official Fetch (FET) BEP-20. Handoff links point at `agent-launch.ai/deploy/<id>` (official domain). Live balances in doc (370.9644 FET, 0 BNB, short 14.04) reproduced exactly. |
| 7 | `AI-USAGE.md` + `docs/fetch-cli.md` honesty | **MINOR** | `docs/fetch-cli.md`: every audit claim independently reproduced — no `eval`/`new Function` in dist; `child_process` only in `create.js`; the hardcoded ASI1 fallback key exists exactly where documented; config written `0o600`; maintainers/timing claims true; descriptions are no-yield/no-investment framed. **But** `AI-USAGE.md` was not touched by lane/sdk — its lane table doesn't disclose Lane SDK's existence (see MINOR-2). |

Additional independent verifications (beyond the assigned checklist):

- **Agentverse identities re-derived**: `Agent(name, seed="{name}-triproto-2026")` via `uagents`
  reproduces all three `agent1q…` addresses in `cohort.json` exactly ($SHAKA, $PIT, $OHANA).
  No typos, no substituted identities.
- **Exit codes**: dry-run 0 · `--yes` w/o API key 1 · invalid key 1 · wrong chain 1 ·
  no identity → safe dry-run 0.
- **Anti-whale default sanity**: `maxWallet: 2` = 1% of 1B = 10M — math in docs is correct.
- **Fail-closed defaults**: unknown balances → gates INSUFFICIENT, `--yes` refuses.

## Findings

### MINOR-1 — docs republish a full live credential (upstream's)
`docs/fetch-cli.md` §1 prints the **complete** hardcoded ASI1 shared fallback API key
(`sk_2a3c92a0…860b`, 70 chars) found in the CLI's `create.js`. Flagging it upstream is
right; mirroring the full secret into our repo is not — CROPS doctrine is to never amplify
credentials, even someone else's leaked ones. **Fix:** mask it (`sk_2a3c92a0…[64 hex]`) in
the doc. (Our lane never invokes `create`, so the key itself never touches our flow.)

### MINOR-2 — disclosure gaps for the new lane
- `AI-USAGE.md` lane table (A–F) doesn't mention Lane SDK / `integrations/fetch-cli/**` —
  add a row before submission so the disclosure stays complete and honest.
- `LANES.md` has no row for lane/sdk itself (its author may add it; noting here so it
  isn't lost).

### NIT-1 — `npm run preflight` doesn't load `.env`
Standalone `src/preflight.mjs` never calls `loadEnv`, so the documented flow
(`cp .env.example .env` → `npm run preflight`) reports "No deployer address resolved" and
exits 1 even with a correct `.env`. Fails **closed** (no safety impact; `deploy-cohort.mjs`
loads `.env` correctly). Fix: call `loadEnv` in the standalone path or note "export the var"
in the README.

### NIT-2 — `deployments/README.md` references a `.gitkeep` that isn't committed
Either add it or drop the mention. (The gitignore rules already keep the dir clean.)

### NIT-3 — `--json` mode is stdout-silent
With `--json`, all human output is suppressed and machine-readable lines go only to
`deployments/log.jsonl`. Works, but one line in the README would prevent confusion
(the upstream CLI's `--json` prints JSON to stdout; ours doesn't — different contract).

## What was verified strong (call-outs)

- The **chain gate actually fires** — tested against a live Ethereum RPC, not just read.
- The **key never leaves the machine** — architecture makes exfiltration structurally hard:
  no signing, no broadcasting, API auth is a separate key, on-chain spend is human-only.
- The **audit section of `docs/fetch-cli.md` is truthful** — every claim reproduced from the
  installed tarballs. This kind of verify-then-trust writeup is exactly the CROPS pattern.
- **Zero gas/FET can move without a human in MetaMask** — the most important property of
  this design, and it holds.

## Bottom line

Lane SDK is CROPS-clean in every safety dimension that matters: keys sealed, dry-run by
default, chain-56 hard-gated, balance gate ≥ fee + ~20%, genuine pinned upstream package,
honest docs. Apply MINOR-1 (mask the republished key) and MINOR-2 (disclose the lane in
`AI-USAGE.md`) at the next convenience commit; NITs optional. Verdict: **MINOR — approved
to proceed** to the human-handoff ceremony once FET ≥ 385 and a few dollars of BNB gas land
in the deployer wallet (pre-existing blockers, correctly reported by the lane).
