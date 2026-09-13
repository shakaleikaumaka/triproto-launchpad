# LANES — build ownership (touch ONLY your paths; push your branch)
Update ONLY your row here (pull → edit → push; retry on conflict). Status: 🟡 building / 🟢 done / 🔴 blocked.
- Lane A contracts → branch `lane/contracts` → `contracts/**` — 🟢 done (AgentLaunchRegistry + ENSv2SubnameIssuer; 20/20 tests; dedicated ENSv2 + fallback; event spine + deploy runbook in contracts/README.md)
- Lane B world → branch `lane/world` → `integrations/world/**`, `docs/world.md` — 🟢 done (verified-human-operator Selfie Check: client verify.js + backend server.mjs + demo + tests green; feedback doc docs/world.md; sandbox = Shaka's Developer Portal account)
- Lane C graph → branch `lane/graph` → `subgraph/**`, `web/pulse/**` — 🟢 LIVE — Studio endpoint serving (4 agents indexed), Pulse badge 🟢 live (mock hidden), API key baked
- Lane D hedera → branch `lane/hedera` → `integrations/hedera/**`, `docs/hedera.md` — 🟡 harness done & live-facilitator-verified, real-settlement E2E blocked only on faucet signup wall (30-sec human tap, see docs/hedera.md)
- Lane E research → branch `lane/research` → `research/**`, `docs/chainlink.md`, `docs/inch.md`, `docs/fetch-bsc.md`, `docs/cardano.md` — 🟢 done
- Lane F ui-docs → branch `lane/ui` → `web/**` (except web/pulse), `AI-USAGE.md`, `SUBMISSION.md`, `docs/demo-script.md` — 🟢 done
