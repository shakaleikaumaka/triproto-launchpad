# LANES — build ownership (touch ONLY your paths; push your branch)
- Lane A contracts → branch `lane/contracts` → `contracts/**` — 🟢 done (AgentLaunchRegistry + ENSv2SubnameIssuer; 20/20 tests; dedicated ENSv2 + fallback; event spine + deploy runbook in contracts/README.md)
- Lane B world → branch `lane/world` → `integrations/world/**`, `docs/world.md` — 🟢 done (verified-human-operator Selfie Check: client verify.js + backend server.mjs + demo + tests green; feedback doc docs/world.md; sandbox-ready, only blocker = Shaka's Developer Portal account)
- Lane C graph → branch `lane/graph` → `subgraph/**`, `web/pulse/**`
- Lane D hedera → branch `lane/hedera` → `integrations/hedera/**`, `docs/hedera.md`
- Lane E research → branch `lane/research` → `research/**`, `docs/chainlink.md`, `docs/inch.md`, `docs/fetch-bsc.md`, `docs/cardano.md`
- Lane F ui-docs → branch `lane/ui` → `web/**` (except web/pulse), `AI-USAGE.md`, `SUBMISSION.md`
Update ONLY your row here (pull → edit → push; retry on conflict). Status: 🟡 building / 🟢 done / 🔴 blocked.
