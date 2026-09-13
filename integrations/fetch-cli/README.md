# triproto-fetch-cli 🛡️

CROPS-safe automation for the triproto cohort's agent-token launch on
**agent-launch.ai** (Fetch.ai's launchpad, **BSC mainnet, chain 56**) — wraps
[`@fetchai/agent-launch-cli@2.0.1`](https://www.npmjs.com/package/@fetchai/agent-launch-cli)
+ `@fetchai/agent-launch-sdk@0.3.0` (both **pinned exactly**) with mandatory
safety gates. Full documentation: [`docs/fetch-cli.md`](../../docs/fetch-cli.md).

## Tokens

| Token   | Agentverse identity (fresh, triproto seed)          |
| ------- | --------------------------------------------------- |
| $SHAKA  | `agent1qf3d4ha4zg0s…e80lp` (seed `shaka-triproto-2026`)  |
| $PIT    | `agent1q0z0wlljcx…n8zl3` (seed `pit-triproto-2026`)      |
| $OHANA  | `agent1qft6wuyajh…qt5s` (seed `ohana-triproto-2026`)     |

Config lives in `cohort.json` (names, descriptions, maxWallet cap, category).

## Usage

```bash
npm install                 # installs pinned deps
cp .env.example .env        # then EDIT
chmod 600 .env              # mandatory (loader warns otherwise)

# ① DRY-RUN DEFAULT — full tx preview, sends nothing, needs NO secrets:
npm run deploy
#    (or: node src/deploy-cohort.mjs)

# ② pre-flight only (read-only RPC balance/chain probe):
npm run preflight

# ③ actually create API-side token records (needs AGENTVERSE_API_KEY):
npm run deploy:yes
```

After records are created the tool prints per-token **handoff links**. The
on-chain deployment (approve 120 FET → deployer contract → `deploy()`) is a
**human MetaMask step by platform design** — we honor that; this tool never
broadcasts an on-chain transaction. Ledger: `deployments/bsc.json`
(gitignored runtime artifact).

## Gates (always on)

1. dry-run default · 2. env-only key (local address derivation, never sent) ·
3. per-token FET balance ≥ remaining×120+buffer · 4. ledger file · 5. mask-all
logging · 6. chainId==56 enforced · 7. human handoff for the irreversible
on-chain step.
