# LANE D — Hedera x402 rail

An **x402-gated paid endpoint** on **Hedera testnet**, settled through the hosted
**Blocky402 facilitator** (`https://api.testnet.blocky402.com`, open access, no API key),
plus a **paying client (agent)** that completes one real paid request end-to-end.

Built for the My Agent ʻOhana launchpad — Hedera *"AI & Agentic Payments"* bounty lane.
The paid resource is a canned **Terri the Turtle** camp-ops answer — it stands in for
any agent answer sold per-request by the launchpad.

```
client (agent)                resource server                Blocky402 facilitator
     │  GET /terri                    │                               │
     │ ─────────────────────────────► │                               │
     │            402 + requirements  │                               │
     │ ◄───────────────────────────── │                               │
     │  signs TransferTransaction     │                               │
     │  (payer key, partial sig)      │                               │
     │  retry + PAYMENT-SIGNATURE ──► │ ── POST /verify ─────────────► │
     │                                │ ◄── isValid: true ─────────── │
     │                                │ ── POST /settle ─────────────► │
     │                                │ ◄── tx settled on Hedera ──── │ (facilitator
     │ ◄──────── 200 + Terri answer ─ │                               │  pays the fees)
```

## Quick start

```bash
npm install
npm run genkeys            # → paste output into .env (cp .env.example .env first)
# paste PAYER_EVM at https://portal.hedera.com/faucet → "Receive 10 testnet HBAR"
npm run setup              # completes the payer account + auto-creates receiver + fills IDs
npm run e2e                # boots server + paying client, one REAL paid request
```

## What's here

| path | role |
|---|---|
| `src/server.mjs` | express resource server — `GET /terri` gated by `@x402/express` paymentMiddleware, `exact` scheme, HBAR (`0.0.0`), 100,000 tinybar (0.001 ℏ) |
| `src/client.mjs` | paying agent — `@x402/fetch` + `@x402/hedera` signer; pays and prints the settlement proof |
| `src/mock-facilitator.mjs` | ⚠️ **MOCK — offline demos only.** Same HTTP shape, fabricates success, **no chain writes** |
| `scripts/setup-accounts.mjs` | completes the faucet's hollow payer account + auto-creates the receiver |
| `scripts/genkeys.mjs` | fresh ECDSA keypairs |
| `scripts/e2e.mjs` | one-command end-to-end run (prints the raw 402 challenge too) |

## Mock mode (offline)

```bash
npm run e2e:mock
```

Boots the **clearly-labeled** mock facilitator locally; every payload "succeeds",
transaction ids are fabricated (`0.0.MOCK@…`). Use only when the hosted facilitator
or the faucet is unreachable. Real E2E never sets `MOCK_FACILITATOR`.

## Notes

- x402 **v2** wire format; Hedera `exact` scheme = partially-signed
  `TransferTransaction`; the facilitator co-signs as fee payer (`extra.feePayer`
  from `GET /supported`), so the merchant never pays gas.
- Price is in **tinybars** via `price: { amount, asset: '0.0.0' }` (HBAR).
  USDC would be `asset: '0.0.429274'` on testnet.
- Verify settlements on <https://hashscan.io/testnet>.
