# LANES — build ownership (touch ONLY your paths; push your branch)
- Lane A contracts → branch `lane/contracts` → `contracts/**`
- Lane B world → branch `lane/world` → `integrations/world/**`, `docs/world.md`
- Lane C graph → branch `lane/graph` → `subgraph/**`, `web/pulse/**`
- Lane D hedera → branch `lane/hedera` → `integrations/hedera/**`, `docs/hedera.md`
- Lane E research → branch `lane/research` → `research/**`, `docs/chainlink.md`, `docs/inch.md`, `docs/fetch-bsc.md`, `docs/cardano.md`
- Lane F ui-docs → branch `lane/ui` → `web/**` (except web/pulse), `AI-USAGE.md`, `SUBMISSION.md`, `docs/demo-script.md` — 🟢 done (pushed: pad front door `web/index.html` in preview mode w/ vendored ethers, submission draft, demo script; config fill pending Lane A deploy)
Update ONLY your row here (pull → edit → push; retry on conflict). Status: 🟡 building / 🟢 done / 🔴 blocked.
