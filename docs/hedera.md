# LANE D — Hedera x402 rail

**Goal (Hedera "AI & Agentic Payments" bounty):** an x402-gated paid endpoint on
Hedera testnet settled through the hosted **Blocky402 facilitator**, plus a client
(agent) that completes one real paid request end-to-end. The paid resource is a
canned **Terri the Turtle** camp-ops answer — the demo shape any launchpad agent
answer can be sold behind per requests.

## Status: 🟢 REAL-SETTLEMENT E2E COMPLETE — full paid request settled on Hedera testnet through Blocky402

| piece | state |
|---|---|
| Resource server (`GET /terri`, x402 v2, `exact` scheme, 0.001 tℏ HBAR) | ✅ real |
| Paying agent client (`@x402/fetch` + `@x402/hedera` signer; ED25519 + ECDSA DER auto-detect) | ✅ real |
| Blocky402 hosted testnet facilitator handshake | ✅ **live-verified** (server syncs `feePayer 0.0.7162784` straight from `GET https://api.testnet.blocky402.com/supported` at boot) |
| Funded payer provisioning | ✅ **solved** — pre-funded existing account used directly (Shaka's `0.0.10511368`, ED25519, 1000 tℏ); hollow-completion path skipped when `PAYER_ACCOUNT_ID` is mirror-verified |
| Receiver auto-creation (~5 tℏ from payer, alias transfer) | ✅ settled on-chain — receiver `0.0.10514699` — tx `0.0.10511368@1789263956.124110869` |
| Full paid-request E2E with **real on-chain settlement** | ✅ **SETTLED ON-CHAIN** — tx `0.0.7162784@1789264118.054067693`, mirror-verified (proof below) |
| Full paid-request E2E vs **mock** facilitator | ✅ green (offline fallback only, clearly labeled) |
| docs/runbook | ✅ (`npm run setup && npm run e2e`) |

## What's live vs mocked

**Live/real:**
- `src/server.mjs` — `@x402/express` `paymentMiddleware`, v2 wire format,
  `price: { amount: '100000', asset: '0.0.0' }` (HBAR, tinybars), `payTo` from
  `RECEIVER_ACCOUNT_ID`.
- `src/client.mjs` — `wrapFetchWithPayment` + `x402Client.fromConfig` with
  Hedera `exact` client signer; HBAR explicitly opted into
  `spendControls.allowedAssets` with a per-payment atomic cap (`1000000` tinybar
  = 0.01 ℏ). Payer key parsing is DER auto-detect — ED25519 (`302e…`) and ECDSA
  (`3030…`) both accepted, so any funded testnet account can be the payer.
- `scripts/setup-accounts.mjs` — two paths: **(A)** `PAYER_ACCOUNT_ID` set →
  mirror-checks exists+balance, **skips hollow-account completion entirely**,
  uses that account directly as payer (this is how Shaka's `0.0.10511368`
  settled); **(B)** fresh faucet flow → completes the hollow payer as before.
  Both then auto-create the receiver via an alias transfer (~5 tℏ) and persist
  ids to `.env` (local-only: gitignored + chmod 600). Idempotent receiver reuse.
- Default `FACILITATOR_URL=https://api.testnet.blocky402.com` — open access, no
  API key, advertises `hedera:testnet` with fee payer `0.0.7162784`.

**Mocked (⚠️ clearly labeled, offline demos ONLY):**
- `src/mock-facilitator.mjs` — implements `/supported`, `/verify`, `/settle`
  with fabricated success and `0.0.MOCK@…` transaction ids. No chain writes.
  Only used when `MOCK_FACILITATOR=1`. The real lane never sets it.

## Proofs

### 1) Real account provisioning — existing funded payer, no hollow completion

`npm run setup` with `PAYER_ACCOUNT_ID=0.0.10511368` preset:

```
payer key type: ED25519 (EVM derivation n/a)
receiver EVM alias        : 0xfd7eea92fff0ca5cbd47e2a6a17e0bf1be76e40f
payer (explicit id) : 0.0.10511368 | balance: 1000 tℏ | key on record: ED25519
✓ PAYER_ACCOUNT_ID set → hollow-account completion SKIPPED (existing account, direct use)
→ auto-creating receiver: 5 tℏ → alias 0xfd7eea92fff0ca5cbd47e2a6a17e0bf1be76e40f
✓ transfer | status: SUCCESS | tx: 0.0.10511368@1789263956.124110869
receiver created     : 0.0.10514699 | balance: 5 tℏ
```

- Auto-create tx (HashScan): https://hashscan.io/testnet/transaction/0-0-10511368-1789263956-124110869
- Receiver account (HashScan): https://hashscan.io/testnet/account/0.0.10514699
- Payer account (HashScan): https://hashscan.io/testnet/account/0.0.10511368

### 2) Real on-chain settlement — one paid agent request, settled by Blocky402

`npm run e2e` (live facilitator, no mock):

```
═══ 402 CHALLENGE (no payment) ═══
HTTP 402
PAYMENT-REQUIRED (decoded): { "scheme": "exact", "network": "hedera:testnet",
  "amount": "100000", "asset": "0.0.0", "payTo": "0.0.10514699",
  "maxTimeoutSeconds": 300, "extra": { "feePayer": "0.0.7162784" } }   ← live from Blocky402 /supported

[client] 🤖 paying client: 0.0.10511368 → GET http://localhost:4021/terri
HTTP 200 in 2169ms  — Terri answer served (paid: true, 100000 tinybar = 0.001 ℏ)

═══ x402 SETTLEMENT ═══
  success    : true
  transaction: 0.0.7162784@1789264118.054067693
  network    : hedera:testnet
  payer      : 0.0.10511368
```

### 3) Mirror verification (independent of the captured transcript)

`GET https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.7162784-1789264118-054067693`:

```json
{ "name": "CRYPTOTRANSFER", "result": "SUCCESS", "transfers": [
  { "account": "0.0.7162784",  "amount": -268106 },   ← facilitator pays the network fee
  { "account": "0.0.10511368", "amount": -100000 },   ← payer (agent) spends 0.001 ℏ
  { "account": "0.0.10514699", "amount": 100000 } ] } ← merchant (receiver) collects
```

- Settlement tx (HashScan): https://hashscan.io/testnet/transaction/0-0-7162784-1789264118-054067693
- Merchant collects payment **and never pays gas** — the facilitator co-signs as
  fee payer (`0.0.7162784`), exactly the x402 `exact` settle design.

### 4) Live facilitator handshake

Bare request while the server is on the real facilitator returns the 402 with the
facilitator's real fee payer merged in (`extra.feePayer: 0.0.7162784`, synced
from Blocky402 `/supported` at boot).

### 5) Mock-mode full loop (offline fallback only)

```
$ MOCK_FACILITATOR=1 npm run e2e
═══ 402 CHALLENGE ═══ HTTP 402
[client] HTTP 200 in 60ms — Terri answer served
═══ x402 SETTLEMENT ═══ success: true (MOCK label), network hedera:testnet
```

Fabricated ids only; the mock never talks to a chain. Not part of the real demo.

## Historical note (the wall that used to block this)

The original blocker was **faucet funding**, not the facilitator: the Hedera
anonymous faucet's reCAPTCHA IP-soft-blocked this container ("automated
queries"), and Hashport's alternate faucet demanded a Human Passport score.
**Resolved by using a pre-funded existing account** (Shaka's `0.0.10511368`)
which skipped the faucet + hollow-completion flow entirely — setup Path A above.
The fresh-faucet Path B (query-key hollow completion) stays in the script for
reproduction from scratch, and the faucet instructions remain in `.env.example`.

## Research summary (why this shape)

- Blocky402 = open x402 facilitator (MIT, self-hostable). Hosted testnet: Polygon
  Amoy, Solana Devnet, **Hedera Testnet** — no API key, 100 req/min/IP.
  Endpoints: `GET /supported`, `POST /verify`, `POST /settle`.
- Hedera `exact` scheme = partially-signed `TransferTransaction`; client signs
  the transfer, facilitator co-signs as *fee payer* (`extra.feePayer`) and
  submits → merchant never pays gas. v2 header: `PAYMENT-SIGNATURE`; v2 challenge
  header: `PAYMENT-REQUIRED`.
- Packages: `@x402/core` `x402Client.fromConfig` (⚠️ constructor takes a selector
  function, config only via `fromConfig`), `@x402/hedera` (client/server
  schemes), `@x402/express` (`paymentMiddleware`), `@x402/fetch`.
- HBAR asset id `0.0.0`; testnet USDC `0.0.429274`. Non-default assets need
  explicit `spendControls.allowedAssets` opt-in on the client.
- Alternates also-on: `https://x402.org/facilitator` also advertises
  `hedera:testnet` (fee payer `0.0.9185802`) — valid facilitator fallback
  configured only if Blocky402 goes down.

Refs: blocky402.com · hedera.com/blog/hedera-and-the-x402-payment-standard ·
github.com/hedera-dev/x402-inference-pay-per-request-poc ·
docs.hedera.com/solutions/ai/x402
