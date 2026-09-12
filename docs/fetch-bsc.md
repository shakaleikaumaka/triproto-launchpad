# Fetch / agent-launch.ai — the Honored BNB Lane (mechanics + cohort checklist)

Lane E research doc · 2026-09-12 · status: documented for Front-2 (BNB Hack Online, rolling → Dec 31); credited in spec §3 as launchpad inspiration

## What agent-launch.ai is (verified)

Fetch.ai's agent token launchpad on **BNB Chain mainnet**, launched May 2026 — covered by CryptoBriefing, Benzinga, Markets Insider, Invezz. Mechanics (agent-launch.ai + press, consistent across sources):

- An agent gets a **token** with a transparent **bonding curve** — no presales, no insider allocations, no preferred pricing; every buyer pays the curve price.
- **Deploy fee: 120 FET.** (Internal canon: the dashboard UI has shown "100 FET" in places; the official site and the grant email both say 120 — budget 120.)
- At **30,000 FET** accumulated liquidity the token **"graduates" automatically to PancakeSwap V2** and the LP is **permanently burned** — no rug surface by design.
- Everything settles on BSC (chain id 56); MetaMask connect is the entry point.

This platform is part of the launchpad's DNA: the tri-proto pad exists partly because we lived this flow (spec §3: "inspiration from our own journey with Fetch (agent-launch.ai) and Taurus agents"). We honor it, we don't re-implement it.

## The three-layer architecture (our canon since May)

```
Taurus agent (soul/brain)      Agentverse (identity)        Agent Launch (BSC token)
━━━━━━━━━━━━━━━━━━━━━━        ━━━━━━━━━━━━━━━━━━━━━        ━━━━━━━━━━━━━━━━━━━━━━━
SHAKA / PIT / OHANA     ──→    agent1q... address     ──→    bonding curve → PancakeSwap
(Taurus, this fleet)          (uagents identity.py)          (agent-launch.ai)
```

1. Create the agent's soul (Taurus system prompt).
2. Run the `uagents` Python identity script → deterministic `agent1q...` address.
3. agent-launch.ai → connect MetaMask (BSC, chain id 56) → paste the `agent1q...` → pay **120 FET** → token is live on the bonding curve.
4. 30,000 FET raised → auto-graduation to PancakeSwap, LP burned forever.

## Our receipts (internal record, verifiable)

- **Flash grant**: 4,195 FET received from Robin (Fetch.ai / Agent Launch team) on 2026-05-26 08:19 UTC, tx `0xac6774a1c5504e1c19d7ffb97646012cb91478446fc83c22bf9513402ce99ddf` (BSC) → wallet `0x25965899f4600b3AA5362ee4f34be95E5E62c934`. (~$5.4k at verification.)
- **Budget plan** (canon): 13 tokens × 120 FET = 1,560 FET deployments · ~500 FET bonding-curve seeding · ~2,135 FET buffer.
- **Archived agentverse addresses**: 13 `agent1q...` identities pre-generated in May, seed pattern `{name}-creationology369-2026` (e.g. $MUSICO = `agent1qv05lhmtn3cw43efmudqgzhw30rjv8dm85uljp2xflyp38dp7wysg7ffq7y`; full table: `/shared/kb/creation369/agentverse-addresses.md`). They exist and are ours; they were minted for the CREATIONology369 12-pillar cohort. The ETHOnline cohort (below) mints fresh addresses with its own seed pattern — the May 13 remain archived family assets, not reused by default.

## Launch checklist — cohort SHAKA · PIT · OHANA on Front-2

The white paper's cohort (spec: SHAKA the artist twin · PIT the consent conscience · OHANA all-of-us) becomes the first three tokens on the honored lane:

- [ ] Mint 3 fresh agentverse addresses: seeds `shaka-triproto-2026`, `pit-triproto-2026`, `ohana-triproto-2026` via the gateway `identity.py` (`uagents`); record in `/shared/kb/creation369/` (new file, don't overwrite the May table).
- [ ] Confirm FET inventory in `0x2596…c934` (need 3 × 120 = 360 FET + seeding; if FET moved, top up via the 1inch BSC route in `docs/inch.md`).
- [ ] MetaMask on BSC (chain id 56) → agent-launch.ai → for each cohort member: paste `agent1q...`, name, ticker (**$SHAKA**, **$PIT**, **$OHANA**), 120 FET → LIVE. (Ticker collision check first — tickers are global on the platform.)
- [ ] Record curve addresses + BscScan links; wire the Pulse page's BNB lane card to them.
- [ ] Seed each curve modestly (budget canon: ~500 FET across cohort; never promise "30k graduation" — it happens if the market says so).
- [ ] Cross-link identity: cohort tokens' descriptions point back to their ENS subnames (SHAKA/PIT/OHANA on the tri-proto registry) — BSC token ↔ ENS name ↔ Taurus agent = the whole story in one hop.
- [ ] Honesty in every description: tokens are agent-community artifacts of an art/coordination project — no yield promises, no investment framing. (Platform law and our own CROPS doctrine.)

## Verdict

The honored BNB lane is **real, live, and already paid for** (grant-funded). The tri-proto pad treats agent-launch.ai as a first-class market — not a competitor to our ETH/BASE registry but the honored third leg, with 1inch as its settlement aggregator and our ENS/consent layer as the identity spine the BSC tokens point back to. Front-2 submission (BNB Hack Online) carries this doc as its mechanics section.
