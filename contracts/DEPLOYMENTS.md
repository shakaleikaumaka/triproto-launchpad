# DEPLOYMENTS — live testnet legs (Act I dress rehearsal)

*Updated 2026-09-14 (lane/act1-gift-market). Machine-readable reports live beside this file in
`deployments/<chainId>.json` (registry) and `deployments/<chainId>.giftmarket.json` (market).*

Pad / deployer on all EVM testnet legs: `0x04f140e282CaDd99859b75EaAdEdCBA886322667`.

## Sepolia (11155111) — the original leg

| Contract | Address | Notes |
|---|---|---|
| AgentLaunchRegistry | `0x62412fcA6437b914EDD87b85455682Ec73968347` | fallback-label-only · cohort SHAKA=1 PIT=2 OHANA=3 TERRI=4 · indexed by Graph Studio `my-agent-ohana` |
| GiftMarket | `0x4Cbc337c8F63FFc0e8e96D5F5ea89A75eD31E575` | allowlisted as `hireRecorder` on the registry (hires echo into the existing subgraph) |

Dress-rehearsal proof txs (all four verbs live on-chain):
- gift → SHAKA: `0x2105d6c0e94428e7b39b1b94b84753501d3d41d80c2c3443a7972db153105d4e`
- bless → TERRI: `0x2db1c76f474607ceb0a48a41e82e29e7fa0047f7f5344226c0433e0a9a123bd7`
- list #1 ("Aloha Song — dress rehearsal") + hire #1 with registry `Hired` echo ✓

## Base Sepolia (84532) — second market leg

Funded by bridging 0.02 Sepolia ETH through the official Base Sepolia OptimismPortal
(`0x49f53e41452C74589E85cA1677426Ba426459e85`), deposit tx
`0x398e2bcdea0a08702d2d47e7116e96dd5d5501d0d6d2621585a92b6c1b6eeb11` — no faucet needed.

| Contract | Address | Notes |
|---|---|---|
| AgentLaunchRegistry | `0xAfd78515B0Ef275595547d9Cc0207aE326bd8a34` | fallback-label-only · founding cohort mirrored 1:1 via `script/MirrorCohort.s.sol` (SHAKA=1 PIT=2 OHANA=3 TERRI=4, TERRI operator = Shaka's wallet) |
| GiftMarket | `0x24B55471bB1d5Ab29D1D24f102dce6a6a5851937` | allowlisted as `hireRecorder` |

## BSC Testnet (97) — Agent Launch rehearsal leg

**Agent Launch HAS an official testnet mode** (verified 2026-09-14: agent-launch.ai docs +
`fetchai/agent-launch-toolkit`): chainId **97**, testnet FET (**TFET**) at
`0x304ddf3eE068c53514f782e2341B71A80c8aE3C7`. No mock bonding curve needed — the ceremony can be
rehearsed move-for-move on Fetch's real testnet deployment (same 120 FET deploy fee, 30K FET
graduation semantics).

**Status: blocked on gas/tokens, one small human step to unblock.** The official faucet grants
**200 TFET + 0.005 tBNB per claim, up to 3 claims per wallet**, but requires an Agentverse API key:

```
curl -X POST https://agent-launch.ai/api/faucet/claim \
  -H "Content-Type: application/json" -H "X-API-Key: <agentverse-api-key>" \
  -d '{"wallet": "0x04f140e282CaDd99859b75EaAdEdCBA886322667"}'
```

Key comes free from https://agentverse.ai/profile/api-keys (or chat `claim 0x…` to the @gift
agent on Agentverse). No API key was on file in the container at rehearsal time — flagged as the
single ask. Deployer holds 0 tBNB; public BSC faucets are captcha/mainnet-balance gated.
