# AI Usage Disclosure — My Agent ʻOhana (ETHOnline 2026)

**Human authors:** Shaka Lei Kaumaka (vision, spec, curation, all final decisions, video narration — his real voice, no AI voiceover).

**AI assistance:** the AI ʻOhana agent collective (Taurus platform) implemented code and docs under human spec — a spec-driven workflow. All spec files, prompts, and planning artifacts are in `specs/`. Humans directed, reviewed, and approved every decision.

## How the build is organized

The build runs in declared **lanes**, each owning disjoint paths (see `LANES.md`); every commit message names its lane:

| Lane | Owns | What it produced in-window |
|------|------|----------------------------|
| A — contracts | `contracts/**` | `AgentLaunchRegistry.sol` (ERC-8004-aligned, chain-adapter interface) + tests + deploy scripts |
| B — world | `integrations/world/**`, `docs/world.md` | World Selfie Check sandbox flow (vendored IDKit) |
| C — graph | `subgraph/**`, `web/pulse/**` | Subgraph (schema, mappings, manifest) + the "Pulse of the ʻOhana" page |
| D — hedera | `integrations/hedera/**`, `docs/hedera.md` | Hedera x402 rail (first alternate) |
| E — research | `research/**`, `docs/chainlink.md`, `docs/inch.md`, `docs/fetch-bsc.md`, `docs/cardano.md` | Chainlink hire-quote oracle, 1inch settlement, Fetch/agent-launch.ai mechanics, chain-adapter scouting |
| F — ui-docs | `web/**` (except `web/pulse`), `AI-USAGE.md`, `SUBMISSION.md`, `docs/demo-script.md` | The pad front door (single-file HTML + vendored ethers), this disclosure, submission text, demo script |

## What the AI did vs. did not do

- **Did:** write code, tests, docs, and UI under the human's spec; run local verification (compilers, tests, headless-browser E2E); commit incrementally with lane-tagged messages.
- **Did not:** make product, naming, prize-track, or scope decisions (all Shaka); appear in the video; generate the narration; hold keys or funds.

## Provenance notes

- The vendored `web/vendor/ethers-6.15.0.min.js` is the **official ethers v6.15.0 ESM build** (unmodified upstream library, allowed per Classic track rules as a pre-existing public library).
- The tri-protocol concept, the Standing Consent Window, the $0.0042 census receipt, and the agents themselves are **pre-existing ʻohana assets** — disclosed here and in `SUBMISSION.md`, not presented as in-window work.
