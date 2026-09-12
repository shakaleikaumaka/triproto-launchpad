# Pulse of the ʻOhana — subgraph

Indexes **`AgentLaunchRegistry`** events into the live nervous system of the pad
(whitepaper §2 L4). Feeds `web/pulse/index.html`.

**Events indexed:** `AgentLaunched` · `ConsentChanged` · `Hired` · `Blessed` · `Delisted`
**Entities:** `Agent` (aggregate) · `LaunchEvent` / `ConsentEvent` / `HireEvent` / `BlessEvent` / `DelistEvent` (immutable feeds) · `PulseStats` (singleton counters, id `pulse`)
**Consent canon:** `active | paused | withdrawn` — the Standing Consent Window, chain-native.

## Status

- ✅ `graph codegen` + `graph build` — **green** (graph-cli 0.98.1, graph-ts 0.38.2)
- ✅ Build → IPFS upload verified end-to-end (`Build completed: Qmb4XnHyRkGdmCnokka5pQ2vMXZx8Uxg8GT2HjPFkVMv76`)
- 🔴 **Deploy blocked on ONE thing: a Subgraph Studio deploy key** (see below — ~60 seconds for Shaka)

## 🔑 SHAKA'S 60-SECOND DEPLOY (the only blocker)

The pipeline is built and proven; the last hop needs a human login:

1. Open **https://thegraph.com/studio** → **Sign in** with GitHub (or email) — ~20s
2. Click **Create a Subgraph** → name it **`my-agent-ohana`** — ~10s
3. On the subgraph page, copy the **Deploy Key** — ~5s
4. Paste it to the Admiral (chat is fine — it only deploys subgraphs, spends nothing) **or** run it yourself:

```bash
cd subgraph
npm install
npx graph auth <DEPLOY_KEY>          # one-time on any machine
# after Lane A deploys the contract, fill address + startBlock in subgraph.yaml, then:
npx graph codegen && npx graph build
npx graph deploy my-agent-ohana -l v0.0.1
```

5. Studio shows the **Query URL** (`https://api.studio.thegraph.com/query/<id>/my-agent-ohana/<version>`) → drop it into `web/pulse/index.html` (`SUBGRAPH_ENDPOINT`) or pass `?endpoint=` — the Pulse page goes live instantly.

> Exact wall, probed 2026-09-12: `graph deploy` builds + uploads to IPFS fine, then
> `✖ Failed to deploy to Graph node https://api.studio.thegraph.com/deploy/: Deploy key not found.`
> The key is the only missing piece.

## 🧩 Integration TODO (Lane A handshake)

`abis/AgentLaunchRegistry.json` was designed from `specs/whitepaper.html` §2 **before**
`lane/contracts` landed. When Lane A's `contracts/README` publishes real event signatures:

1. Replace `abis/AgentLaunchRegistry.json` with the compiled ABI (or just the events).
2. If signatures differ, update `subgraph.yaml` `eventHandlers` (keep the `indexed` markers —
   graph-cli 0.98 requires them) and adjust `src/mapping.ts` param access.
3. Fill `source.address` (Sepolia deploy) + `source.startBlock` (deploy block = fast sync).
4. `npm run codegen && npm run build && npm run deploy-studio`.

**Tri-chain note:** the registry also ships to Base Sepolia. The Graph indexes one network
per deployment — deploy this same subgraph a second time with `network: base-sepolia` +
the Base address. The Pulse page accepts multiple endpoints (comma-separated) and merges.

## 🏆 Prize-qualification note (The Graph — Best AI Tooling/Use, From Scratch, $5k)

Judges require **live data from a Graph provider** (e.g. Subgraph Studio) — mocked or
local data does **not** qualify. Therefore:

- The Pulse page **defaults to the live Studio endpoint** once `SUBGRAPH_ENDPOINT` is set.
- A clearly-flagged mock mode exists ONLY as a pre-deploy fallback (big amber banner,
  `MOCK DATA` chip). It is a qualification risk if shown to judges — go live before the video.
- The demo's money-shot: an AI agent (the ʻohana) **consuming this subgraph as its source
  of truth on camera** — real reasoning over indexed data, not a printed query.

## Files

| File | What |
|---|---|
| `schema.graphql` | entities + derived feeds + PulseStats singleton |
| `subgraph.yaml` | manifest — sepolia, 5 event handlers, address/startBlock TODO |
| `src/mapping.ts` | AssemblyScript handlers (aggregate Agent + immutable event feeds + counters) |
| `abis/AgentLaunchRegistry.json` | event ABI (spec-designed; reconcile with Lane A) |
| `package.json` | `codegen` / `build` / `deploy-studio` scripts |
