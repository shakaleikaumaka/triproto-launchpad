# deployments/

Runtime output directory. `bsc.json` (ledger) and `log.jsonl` (run log) are
written here by `src/deploy-cohort.mjs` on `--yes` runs. All `*.json` /
`*.jsonl` files in this folder are **gitignored** — only this README and the
`.gitkeep` are committed. Nothing in this directory may contain private key
material; if you ever find any here, treat it as an incident, scrub and rotate.
