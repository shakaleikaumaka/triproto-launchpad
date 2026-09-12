# World integration — feedback document (Selfie Check prize)

**Project:** My Agent ʻOhana — the Tri-Proto Launchpad (ETHOnline 2026)
**Lane:** B (`integrations/world/**`, this doc) · **Prize:** World — Selfie Check
**Integration:** "verified human operator" mark on launchpad listings.
Whitepaper §L4: *"World Selfie Check marks listings operated by a verified human
(World ID = the trust layer, never a blessing-gate)."*

Built and tested against `@worldcoin/idkit-core@4.2.4` (+ `@worldcoin/idkit-server@1.1.1`
via the `/signing` subpath), `environment: 'sandbox'`, preset `selfieCheckLegacy`.
Everything below is from **hands-on testing** in this repo — probes are reproducible
via `integrations/world/test/`.

---

## 1. What we built

- `integrations/world/verify.js` — dependency-free browser module (`window.OhanaWorld`).
  Full flow: fetch signed RP context → `IDKit.request(...).preset(selfieCheckLegacy({signal}))`
  → render QR/deep link → poll → forward proof to backend → badge.
- `integrations/world/server.mjs` — zero-framework Node backend: `/api/world/rp-context`
  (EIP-191 RP signing), `/api/world/verify` (forwards complete IDKit result to
  `developer.world.org/api/v4/verify/{rp_id}`), local nullifier replay guard (JSON store).
- `integrations/world/demo.html` — judge-runnable demo; `window.__v` handle exposed.
- Tests: `test/sign.test.mjs` (RP-signature spec conformance, incl. secp256k1 recovery),
  `test/server.test.mjs` (health, rp-context, malformed/mismatch rejects, replay guard,
  live portal probe with unregistered RP).

## 2. Proof flow (as implemented)

```
UI click → POST /api/world/rp-context {action}        → { rp_id, sig, nonce, created_at, expires_at }
       → IDKit.request({ app_id, action, rp_context, allow_legacy_proofs: true, environment: 'sandbox' })
          .preset(selfieCheckLegacy({ signal: operatorWallet }))
       → QR (cross-device) or deep link (same-device) → sandbox World ID app
       → proof over bridge → POST /api/world/verify { result, action, signal }
       → developer.world.org/api/v4/verify/{rp_id}     → success
       → nullifier stored locally (replay guard)       → 🟢 badge
```

Observed request payload (from `getDebugReport()` in a real browser run):

```json
{ "action": "ohana-operator-verify", "allow_legacy_proofs": true,
  "environment": "sandbox", "package_name": "idkit_js_core",
  "package_version": "4.2.4", "require_user_presence": false,
  "verification_level": "face", "signal": "0x00c5d2..." }
```

## 3. What works today (tested, no Developer Portal account needed)

| check | result |
|---|---|
| RP signature spec (message layout, EIP-191, recoverable secp256k1, TTL) | ✅ `sign.test.mjs` (4 assertions + recovery check) |
| Server endpoints (health / rp-context / verify / replay guard) | ✅ `server.test.mjs` |
| Browser SDK load (global build + WASM over http) | ✅ demo reaches `presenting`, QR renders |
| rp-context fetch → request build → QR → poll loop | ✅ Playwright-driven Chromium |
| Client-side rp_id format validation | ✅ `Invalid RP ID: must start with 'rp_'` thrown before any network |
| Invite-code mode connector | ✅ returns `https://sandbox.world.org/verify?...` (see §5) |
| Live portal probe, unregistered RP | ✅ returns HTTP 400 `app_not_migrated` (see §5.2 — misleading code) |

## 4. Sandbox App states (Hot / Cold / Semi-cold)

Our in-container environment has no iOS/Android device, so device-side states are
documented from the Sandbox guides; client-side (web Hot entry surface) was exercised
for real:

| state | docs claim | observed |
|---|---|---|
| Hot (app installed, maybe enrolled) | straight to face match, enrollment inline if needed | client side: request → QR → poll; works up to bridge handoff ✅ |
| Cold (no app) | install → account → DOB → invite code (iOS) → enroll → Selfie Check | not device-tested (needs enrolled tester device) |
| Semi-cold (existing user, new device) | Android resumes automatically; iOS needs invite-code mode | **per docs, iOS “Sign in” mid-flow has no invite-code path → restart from QR** — we default `inviteCode:false` but ship the flag |

## 5. Errors & edge cases — the honest list

1. **Unregistered RP hangs instead of failing.** With a well-formed but unregistered
   `rp_id`, `pollUntilCompletion` stays at `waiting_for_connection` indefinitely —
   users get a dead QR. We ship `timeout` in our wrapper and recommend surfacing a
   "check config" hint after 60 s of no connection. **Ask: validate the RP at request
   creation (bridge-side) and fail with `unknown_rp`.**
2. **Portal returns a misleading error for unregistered RPs.** Probe:
   `POST /api/v4/verify/rp_0000000000000001` → HTTP 400
   `{"code":"app_not_migrated","detail":"This app has not been migrated to World ID 4.0. Please use the v2 verify endpoint."}`.
   The error-codes page documents `unknown_rp`; the portal emits `app_not_migrated`
   for a nonexistent RP — confusing during integration. **Ask: emit `unknown_rp`.**
3. **RP format enforced client-side with a good error.** Malformed `rp_id`
   (`rp_dummy`) → `Invalid RpContext: Invalid RP ID: must start with 'rp_'` — thrown
   synchronously at request build. (Our dummy value was wrong; the validator is right.)
4. **Node.js can’t run the client flow.** The ESM build initializes WASM via
   `fetch(new URL('idkit_wasm_bg.wasm', import.meta.url))`, and Node’s `fetch`
   rejects `file://` → `Failed to initialize IDKit WASM: TypeError: fetch failed`.
   Browser-only flow is fine for us (backend only needs `/signing`, pure JS), but the
   docs’ "JS SDK" framing invites a Node attempt that fails. **Ask: document
   browser-only bridge, or use `node:` `fs` read for `file://` URLs.**
5. **`environment` maps to a subdomain.** Invite-code connector came back as
   `https://sandbox.world.org/verify?...` — production would be `world.org/verify`.
   Cross-check every link you show users (we had a bug where our own renderer linked
   the wrong host until we saw this).
6. **`allow_legacy_proofs: true` is mandatory for Selfie Check** (returns World ID
   3.0 proofs; 4.0 unsupported). Docs state it once, mid-page. A missing flag fails
   with no obvious message — we set it in the wrapper so integrators can’t forget.
7. **Preset naming.** `selfieCheckLegacy()` is the *new* Selfie Check (Beta) preset.
   "Legacy" here means "v3-protocol fallback", but reads as "deprecated" — cf.
   `deviceLegacy` which *is* deprecated. **Ask: alias `selfieCheck()` once 4.0 lands.**
8. **RP signatures expire.** Default TTL 300 s; long user hesitation →
   `rp_signature_expired`. We fetch a fresh signed context per attempt (OK).
   **Ask: docs should say "issue per attempt" explicitly in Integrate step 3.**
9. **Nullifier replay is YOUR job.** The portal proves cryptographic validity only.
   We normalize hex case and store per-action → `nullifier_replayed` mapped to a
   friendly "already verified" state in the wrapper. (Docs are clear on this — good.)
10. **`verification_level: "face"`** appears in the request payload for Selfie Check
    — a legacy enum leak into the v4 shape; harmless but worth knowing when diffing
    payloads.
11. **Error taxonomy is good.** The error-codes page maps ~25 codes to handling
    advice; we encoded `user_rejected`/`cancelled` → clean retry state and
    `nullifier_replayed`/`max_verifications_reached` → soft-success in the wrapper.

## 6. Test users

Sandbox accounts are **resettable** (delete, re-signup) — adequate for enrollment
testing. What’s missing vs. e.g. Stripe: **no canned test identities / fixtures**
(pre-enrolled selfie personas, deterministic face-match outcomes). Each tester must
physically enroll a face. For CI-grade reliance on Selfie Check that’s a real gap;
for hackathon demos it’s fine. **Ask: ship one documented test account per team or
fixture hooks in the sandbox app.**

## 7. What was confusing / missing (docs feedback)

- **Three test paths, poorly delineated:** simulator (`simulator.worldcoin.org` +
  `environment:'staging'`), Sandbox (`environment:'sandbox'` + gated sandbox app
  builds), and production. The Integrate guide mentions the simulator once;
  Selfie-Check-specific docs point only at Sandbox. Pick-one guidance ("if you can’t
  enroll a device, use the simulator") would have saved us a routing loop.
- **MiniKit vs IDKit split.** `/mini-apps/commands/verify` says verification moved to
  IDKit; npm’s minikit-js README says MiniKit "does not proxy verify APIs". We lost
  time confirming which SDK owned the verify path. A single "verify lives in IDKit"
  banner on the MiniKit landing page would fix it.
- **Sandbox access is gated through the Developer Portal** (tester email enrollment).
  This is the step that needs our team lead’s account (see §8). The "things to know"
  framing undersells that it blocks *all* on-device testing.
- **RP signature pseudocode is excellent** (test-vector-grade; we verified
  conformance). More of this style elsewhere would help.
- **No screenshots of the sandbox app flows** (Hot/Cold/Semi-cold tables are text).
  Judges love screenshots; developers do too.

## 8. What needs Shaka’s Developer Portal account

Everything works sandbox-only-except-one-account, as ordered. The single blocker:

1. **Create app** at <https://developer.world.org> → yields `app_id`, `rp_id`,
   `signing_key` (needed for **both** sandbox and production; sandbox is not
   account-free).
2. **Enroll tester email** under Portal → "World ID Sandbox" sidebar (TestFlight iOS /
   private Play track Android) — needed only for on-device E2E.

Until then, the backend refuses to pretend: `/api/world/health` reports
`configured:false` and the UI fails closed. Credentials land as env vars; no code
changes.

## Appendix — file map

`integrations/world/{verify.js, server.mjs, demo.html, README.md, package.json}`
`integrations/world/vendor/{idkit.global.js, idkit_wasm_bg.wasm, qrcode-generator.js}`
`integrations/world/test/{sign.test.mjs, server.test.mjs}` (+ `probe-client.mjs` kept
as the Node-WASM-failure reproduction)
