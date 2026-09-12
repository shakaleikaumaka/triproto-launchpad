# 1inch — BSC Settlement Narrative (bench track)

Lane E research doc · 2026-09-12 · status: **benched** — integrated narratively, not submitted for the 1inch prize (see honesty note at the end)

## The job

The tri-proto launchpad has an **honored BNB lane** (spec §2/L1): the cohort tokens (SHAKA · PIT · OHANA) live on BNB Chain via agent-launch.ai, and graduates of its bonding curve land on **PancakeSwap**. When treasury or users move value on that lane — buying cohort tokens, rebalancing FET/BNB/USDT for launch fees and bonding-curve seeding — we don't hand-pick a DEX. We aggregate. **1inch is the aggregation layer for the BSC leg.**

## What 1inch on BSC actually is

1inch has supported BNB Chain since Feb 2021. Its Pathfinder algorithm splits a single swap across PancakeSwap (V2/V3), BiSwap, and dozens of other BSC liquidity sources for best effective price — exactly the "settlement narrative" our BNB lane needs: *every swap on the honored lane routes through the deepest aggregated liquidity, not a single pool.*

For the cohort flow specifically:

- **FET → cohort token buys** on the bonding curve happen on agent-launch.ai itself (not 1inch's domain).
- **Everything around it** — acquiring FET for the 120 FET deploy fees, converting graduation proceeds, treasury rebalancing between FET/BNB/stablecoins — routes through 1inch aggregation on chain id **56**.

## API surface (1inch Developer Portal, Swap API v6)

Base: `https://api.1inch.dev/swap/v6.0/56/` — auth via `Authorization: Bearer <API key>` (free dev key from portal.1inch.dev).

| Endpoint | Use in our flow |
|---|---|
| `GET /swap/v6.0/56/quote?src=&dst=&amount=` | Pre-trade quote shown in the treasury UI ("seed 500 FET ≈ N BNB, route: PancakeSwapV3 70% / …") |
| `GET /swap/v6.0/56/approve/allowance?tokenAddress=&walletAddress=` | Check FET/BNB token approval before swap |
| `GET /swap/v6.0/56/approve/transaction?tokenAddress=` | Build the approval tx |
| `GET /swap/v6.0/56/swap?src=&dst=&amount=&from=&slippage=` | Build the swap tx (returns calldata; we sign server-side with the treasury key) |
| `GET /swap/v6.0/56/tokens` | Token allowlist metadata for the UI picker |

Conventions: native BNB = `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`; slippage in percent; responses include `dstAmount`, route `protocols`, and tx payload. The Fusion+ / cross-chain products exist but are out of scope for tonight — the classic aggregation API covers the whole BSC leg.

**Fee honesty:** the 1inch API itself takes no protocol fee on classic aggregation swaps; costs are DEX pool fees + BSC gas (cents). Any partner/integrator fee would be ours to add explicitly — we don't add one in the hackathon build.

## Narrative fit (why this is more than plumbing)

The launchpad's spine is *one ceremony, three markets*. The BSC leg's settlement story, honestly told on camera:

1. Cohort token graduates its bonding curve → LP burned forever on PancakeSwap (agent-launch.ai's mechanism, not ours — credited).
2. From that moment, the token trades inside 1inch's BSC aggregation graph — we show a **live quote card** on the Pulse page (`/quote` for 1 FET → SHAKA via the best route).
3. Treasury ops (the 13×120 FET deployment budget, see `docs/fetch-bsc.md`) execute through `/swap` — receipts link to BscScan from the UI.

That is a real integration (real API, real calldata, real receipts) — but it is **classic 1inch aggregation, not the thing this hackathon's 1inch prize rewards**.

## Honesty note — why we're benching the 1inch prize

Per ethglobal.com/events/ethonline2026/prizes, the ETHOnline 2026 1inch track is an **Aqua / SwapVM build**: *"Projects that utilize SwapVM will be scored higher during the final judging. Official Aqua/SwapVM contracts must be used (redeployments of a modified SwapVM contract is allowed)."* SwapVM is 1inch's programmable swap-execution VM (github.com/1inch/swap-vm); Aqua is its shared-liquidity partner protocol — a liquidity-architecture playground, a different sport from aggregation API calls.

Our BSC leg uses the aggregation API, which is production-real but **not an Aqua/SwapVM build**, and our own markets are Sepolia testnets where the official SwapVM deployment story doesn't map tonight. Bending the project into a SwapVM strategy in the same window as ENS+Graph+World would fake depth we don't have. So: **we bench the prize, keep the integration, and credit 1inch as the honored lane's settlement aggregator** (spec §3: "1inch settlement" on the bench list). If a future lane builds cohort-token launch liquidity as a SwapVM strategy on BSC mainnet, that's a legitimate next-hackathon submission — the door is documented, not claimed.

## Verdict

Integrate as **BSC settlement narrative + live quote card** via `api.1inch.dev/swap/v6.0/56/`. Do not submit the 1inch partner prize — it's an Aqua/SwapVM build and we're honestly not one.
