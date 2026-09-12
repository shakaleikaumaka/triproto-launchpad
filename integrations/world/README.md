# integrations/world — verified human operator (World ID Selfie Check)

Lane B deliverable for the World prize (Selfie Check). Marks a launchpad listing as
operated by a **verified human** via World ID Selfie Check (Beta), sandbox-first.
Whitepaper §L4: *"World ID = the trust layer, never a blessing-gate."*

## What's here

| file | role |
|---|---|
| `verify.js` | browser module — the whole client flow (`window.OhanaWorld`) |
| `server.mjs` | tiny Node backend — RP signing, proof verify, nullifier replay guard |
| `demo.html` | standalone demo / judge-runnable page |
| `vendor/` | pinned `@worldcoin/idkit-core@4.2.4` global build + WASM + qrcode-generator |
| `test/` | sign + server tests (no World credentials needed) |
| `docs/world.md` (repo root `docs/`) | **required World feedback document** |

## Flow

```
pad UI (Lane F)                server.mjs                     World
─────────────                  ──────────                     ─────
click "Verify human operator"
 → POST /api/world/rp-context → signRequest(signing_key)  →  { rp_id, sig, nonce, ts }
 → IDKit.request(...).preset(selfieCheckLegacy({ signal }))
 → QR / deep link  ───────────────────────────────────────→  World ID (sandbox) app
 → human selfies → proof returns over bridge
 → POST /api/world/verify    → forward result            →  developer.world.org /api/v4/verify/{rp_id}
                             → nullifier replay guard (local JSON store)
 ← { ok, nullifier, credential }
badge: 🟢 Verified human operator
```

## Run the demo (sandbox)

1. **Developer Portal (one-time, needs Shaka's account):** create an app at
   <https://developer.world.org> → copy `app_id`, `rp_id`, `signing_key`.
   For on-device sandbox testing also enroll a tester email under **World ID Sandbox**
   (TestFlight iOS / private Play track Android).
2. **Backend:**
   ```bash
   cd integrations/world
   npm i
   WORLD_APP_ID=app_… WORLD_RP_ID=rp_… WORLD_SIGNING_KEY=… WORLD_ENV=sandbox node server.mjs
   ```
3. **UI:** serve the repo root (e.g. `npx serve .`) and open
   `/integrations/world/demo.html`. Scan the QR with the **sandbox** World ID app.
4. Without credentials the server still runs — `/api/world/health` reports
   `configured: false` and the UI fails closed with a clear error.

## Lane F wiring (the tiny API)

```html
<script src="/integrations/world/vendor/qrcode-generator.js"></script>
<script src="/integrations/world/verify.js"></script>
<script>
  const v = OhanaWorld.createOperatorVerifier({
    app_id: window.OHANA_WORLD.app_id,          // from build config
    serverUrl: window.OHANA_WORLD.serverUrl,    // where server.mjs runs
    environment: 'sandbox',                     // flip to 'production' at launch
    signal: listing.operatorAddress,            // binds proof to the operator
    onVerified: (badge) => markListingVerified(listing.id, badge),
    onError: (e) => showVerifyError(e.code)
  });
  v.mount(document.querySelector('#world-btn'), document.querySelector('#world-badge'), document.querySelector('#world-qr'));
</script>
```

- `onVerified(badge)` → `{ nullifier, credential, protocol_version, environment, verified_at }`.
  **Store the nullifier on the listing** — it is the uniqueness anchor (same human +
  same action ⇒ same nullifier, across sessions).
- Badge element gets `data-world-state` = `idle|working|verified|cancelled|failed` for CSS hooks.
- `v.debugReport()` → IDKit debug report (transport, payloads) for support tickets.
- `v.cancel()` aborts an in-flight flow.

## Config notes / gotchas learned (full detail in docs/world.md)

- `allow_legacy_proofs: true` is **required** — Selfie Check returns World ID **3.0**
  proofs today (4.0 support not shipped yet).
- `environment: 'sandbox'` needs the **sandbox build of the World ID app** (gated
  TestFlight / private Play track). The production app will not pick up sandbox requests
  (`invalid_network`).
- Proofs are verified at the **production** endpoint even in sandbox — the
  `environment` field in the result tells the portal it's a sandbox proof.
- RP signatures expire (default TTL 300 s) — request a fresh `rp-context` per attempt
  (verify.js does this automatically).
- Nullifier replay is checked **locally**; the portal only proves cryptographic validity.
