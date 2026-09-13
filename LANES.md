# LANES — build ownership (touch ONLY your paths; push your branch)
- Lane A contracts → branch `lane/contracts` → `contracts/**`
- Lane B world → branch `lane/world` → `integrations/world/**`, `docs/world.md`
- Lane C graph → branch `lane/graph` → `subgraph/**`, `web/pulse/**`
- Lane D hedera → branch `lane/hedera` → `integrations/hedera/**`, `docs/hedera.md` — 🟢 DONE: real on-chain settlement E2E via Blocky402 (tx `0.0.7162784@1789264118.054067693`, hashscan.io/testnet, mirror-verified); payer provisioning supports pre-funded accounts (skips hollow completion, ED25519+ECDSA), mock kept as labeled offline-only fallback — proofs in docs/hedera.md
- Lane E research → branch `lane/research` → `research/**`, `docs/chainlink.md`, `docs/inch.md`, `docs/fetch-bsc.md`, `docs/cardano.md`
- Lane F ui-docs → branch `lane/ui` → `web/**` (except web/pulse), `AI-USAGE.md`, `SUBMISSION.md`
Update ONLY your row here (pull → edit → push; retry on conflict). Status: 🟡 building / 🟢 done / 🔴 blocked.
