# The Ninth Adapter — Cardano vs "Turbo" (decision doc)

Lane E research doc · 2026-09-12 · status: **decision made — Cardano is the documented non-EVM adapter option** (with an honest correction to the "Turbo" lead)

## The question

The tri-proto spine ships with eight lanes spoken for (ETH · BASE · BNB-honored · ENS · Graph · World · Hedera · x402). Shaka floated a **ninth adapter** with two candidates:

- **(a) a Cardano adapter** — "Jeremy's lane"
- **(b) "Turbo"** — per Shaka: *"ETHGlobal cofounder Liam + Dankrad now work at a project called Turbo"*

This doc resolves which one the adapter interface documents.

## Research trail — what "Turbo" actually is

**No project named "Turbo" matching that description is publicly verifiable.** Zero results for the name + people. But the *people* description is uniquely identifying, and it resolves cleanly:

- **Liam Horne** — co-founder of ETHGlobal, former CEO of OP Labs. His own projects page (liamhorne.com) lists his current work: **Tempo** (tempo.xyz), with a "why I joined" post.
- **Dankrad Feist** — the well-known Ethereum Foundation researcher. Multiple independent reports (The Block, ForkLog, Yahoo Finance, CoinDesk): Feist left the EF in 2025 to join **Tempo**.

**"Turbo" ≈ Tempo, misremembered.** What Tempo is (verified via tempo.xyz/faq + press):

- Payments-first **Layer 1 incubated by Stripe and Paradigm**; founder/CEO Matt Huang.
- **Mainnet live since 2026-03-18** — chain id **4217**, RPC `https://rpc.tempo.xyz`; public testnet **Moderato**, chain id 42431.
- **Fully EVM-compatible** (built with the Reth SDK): Solidity, Foundry, Hardhat all work unchanged. Fees paid in USD stablecoins, sub-cent transfers, no re-orgs.
- Validators include Stripe, Visa, MoneyGram, Zodia Custody; node software Apache-2.0 open source.
- **MPP — the Machine Payments Protocol** (mpp.dev), an open standard co-authored by Stripe and Tempo: agents pay for services inline with an HTTP request — the same shape as our x402 machine-pennies rail.

So the "Turbo" lead is real signal with a wrong label — and it carries a twist that decides this doc: **Tempo is EVM. It is not a non-EVM adapter at all.**

## The comparison

| | (a) Cardano | (b) "Turbo" → actually **Tempo** |
|---|---|---|
| Execution model | eUTXO, Plutus/Aiken — genuinely non-EVM | EVM (Reth SDK) — our existing contract stack runs as-is |
| Adapter-interface fit | Hard: needs a relayer pattern — off-chain chain-follower (Blockfrost/Lucid), on-chain minting policy for agent-identity tokens, an event bridge to feed the Pulse subgraph | Trivial: new chain id + RPC endpoint behind the same EVM adapter we already wrote |
| Build cost (honest) | Days + a new mental model, new tooling, new key management | Hours (config + deploy + verify) |
| Ecosystem fit | Jeremy's lane; large community; real decentralization story | Stripe/Visa distribution; MPP is a *narrative twin* of our x402 rail; Liam's ETHGlobal heritage makes it emotionally adjacent to this very hackathon |
| Verifiability today | Cardano is exactly what it says it is | Name "Turbo" unverifiable; Tempo fully verified (chain id 4217 live, docs public) |
| What it proves in the tri-proto story | **The adapter interface is genuinely chain-agnostic** — a non-EVM chain plugs in without redeploying the spine | The spine's EVM reach extends for free; MPP alignment is a roadmap gem, not a hackathon lane |

## Plausibility of the non-EVM adapter

The adapter interface (`IChainAdapter`-style: `launch(agent) → (chainAgentId, txRef)`, `revoke(consentRef)`, `events() → Pulse feed`) is implementable on Cardano, with honest caveats:

- **Identity/launch**: a native-token minting policy (Aiken validator) where each agent = one minted NFT carrying the ENS subname hash in metadata; the registry event reaches Pulse via a chain-follower that posts into the subgraph's ingestion path. Plausible, standard pattern.
- **Consent**: revocation = spending the identity UTxO to a "withdrawn" script address — the eUTXO model actually expresses consent-state transitions *beautifully* (one UTxO per state, spent to transition). This is the strongest technical argument for the Cardano lane.
- **Cost honesty**: nothing on tonight's critical path can absorb a Plutus build. Milkomeda (Cardano's EVM sidechain) would make it cheap — but then it's EVM again and proves nothing about non-EVM pluggability.

## Decision

**Document the Cardano adapter as the ninth-adapter option.** Rationale:

1. The task's own honesty rule holds: "Turbo" is unverifiable under that name — we say so plainly.
2. The *spirit* of the ninth slot is proving the adapter interface is chain-agnostic. Only a genuinely non-EVM chain proves that. Tempo, being EVM, would prove nothing about the interface — it would just be market #4 on the EVM bus.
3. Cardano's eUTXO consent-transition mapping is a real design asset for Jeremy's lane, worth the documentation even at bench depth.

**And the honest footnote for Shaka:** your "Turbo" is almost certainly **Tempo** (Liam Horne + Dankrad Feist both confirmed there). Don't lose that lead — it's just a *different* lane than this one: Tempo belongs on the **EVM fast-track roadmap** (chain id 4217, MPP ↔ x402 kinship — a payments L1 whose agent-payments standard reads like a cousin of our machine pennies). One word from you and we draft `docs/tempo.md` as the tenth-lane tease. Confirm the name with Liam's people at the next ETHGlobal touchpoint rather than taking our correction as gospel.

## Verdict

Ninth adapter = **Cardano** (documented, bench-depth, Jeremy's lane — non-EVM proof of the tri-proto claim). "Turbo" = unverifiable as named; the people point to Tempo, which is EVM and therefore ineligible for the non-EVM slot but valuable on the roadmap.
