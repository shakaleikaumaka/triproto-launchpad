/**
 * OhanaWorld backend — RP signing + proof verification + nullifier replay guard.
 *
 * Zero-framework Node (>=18) server. The ONLY secret is WORLD_SIGNING_KEY and it
 * never leaves this process. Two endpoints the pad UI needs:
 *
 *   POST /api/world/rp-context  { action }                 → { rp_id, sig, nonce, created_at, expires_at }
 *   POST /api/world/verify      { result, action, signal } → { ok, nullifier, credential, ... }
 *   GET  /api/world/health                                 → { ok, configured, environment }
 *
 * Env:
 *   WORLD_APP_ID       app_... from Developer Portal
 *   WORLD_RP_ID        rp_... from Developer Portal
 *   WORLD_SIGNING_KEY  hex secp256k1 key from Developer Portal (KEEP SECRET)
 *   WORLD_ENV          sandbox | staging | production   (default: sandbox)
 *   WORLD_STORE        path to nullifier JSON store     (default: ./nullifiers.json)
 *   PORT               listen port                      (default: 8420)
 *
 * Run:  npm i && WORLD_APP_ID=app_… WORLD_RP_ID=rp_… WORLD_SIGNING_KEY=… node server.mjs
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { signRequest } from '@worldcoin/idkit-core/signing';

const PORT = Number(process.env.PORT || 8420);
const ENV = process.env.WORLD_ENV || 'sandbox';
const APP_ID = process.env.WORLD_APP_ID || '';
const RP_ID = process.env.WORLD_RP_ID || '';
const SIGNING_KEY = process.env.WORLD_SIGNING_KEY || '';
const STORE = process.env.WORLD_STORE || new URL('./nullifiers.json', import.meta.url).pathname;
const VERIFY_URL = `https://developer.world.org/api/v4/verify/${RP_ID}`;
const RP_TTL_SECONDS = 300; // docs default; signature expires → client must re-request

const configured = Boolean(APP_ID && RP_ID && SIGNING_KEY);

/* ---------------- nullifier store (replay protection) ---------------- */
function loadStore() {
  try { return existsSync(STORE) ? JSON.parse(readFileSync(STORE, 'utf8')) : {}; }
  catch { return {}; }
}
function saveStore(s) { writeFileSync(STORE, JSON.stringify(s, null, 2)); }
// Nullifiers are 256-bit hex — normalize to lowercase 0x-hex so casing can't bypass the check.
function normNullifier(n) { return String(n || '').toLowerCase(); }

/* ---------------- helpers ---------------- */
function json(res, code, body) {
  const b = JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(b);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 4_000_000) req.destroy(); });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

/* ---------------- endpoints ---------------- */
async function handleRpContext(req, res) {
  if (!configured) return json(res, 503, { error: 'server not configured: set WORLD_APP_ID, WORLD_RP_ID, WORLD_SIGNING_KEY' });
  const body = await readBody(req);
  const action = typeof body.action === 'string' ? body.action : '';
  // signRequest: EIP-191 over version||nonce||created_at||expires_at||hash(action). TTL 300s.
  const sig = signRequest({ signingKeyHex: SIGNING_KEY, action: action || undefined, ttl: RP_TTL_SECONDS });
  return json(res, 200, {
    rp_id: RP_ID,
    sig: sig.sig,
    nonce: sig.nonce,
    created_at: sig.createdAt,
    expires_at: sig.expiresAt
  });
}

async function handleVerify(req, res) {
  if (!configured) return json(res, 503, { ok: false, error: 'server not configured', code: 'not_configured' });
  const body = await readBody(req);
  const result = body.result;
  if (!result || !result.protocol_version || !Array.isArray(result.responses)) {
    return json(res, 400, { ok: false, error: 'malformed result: expected IDKitResult with responses[]', code: 'malformed_request' });
  }
  // Bind the proof to OUR action — never trust the client to pick it.
  if (body.action && result.action && body.action !== result.action) {
    return json(res, 400, { ok: false, error: `action mismatch: expected ${body.action}, got ${result.action}`, code: 'action_mismatch' });
  }

  // Replay guard BEFORE hitting the portal (cheap) — the portal also enforces, but
  // we must enforce locally anyway (docs: portal only proves cryptographic validity).
  const store = loadStore();
  const primaryNullifier = normNullifier(result.responses[0] && result.responses[0].nullifier);
  if (primaryNullifier && store[primaryNullifier]) {
    return json(res, 200, {
      ok: true, already: true,
      nullifier: primaryNullifier,
      credential: store[primaryNullifier].credential,
      first_verified_at: store[primaryNullifier].verified_at,
      note: 'nullifier already on file — same human, same action'
    });
  }

  // Forward the COMPLETE IDKit result — no remapping (per /api-reference verify docs).
  let portal;
  try {
    const r = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    });
    portal = await r.json().catch(() => ({}));
    if (!r.ok) {
      return json(res, 200, {
        ok: false,
        error: portal.detail || portal.message || `developer portal HTTP ${r.status}`,
        code: portal.code || 'portal_rejected',
        portal_status: r.status
      });
    }
  } catch (e) {
    return json(res, 502, { ok: false, error: 'developer portal unreachable: ' + e.message, code: 'connection_failed' });
  }

  const first = (portal.results && portal.results[0]) || {};
  const nullifier = normNullifier(first.nullifier || primaryNullifier);
  if (portal.success && nullifier) {
    store[nullifier] = {
      action: result.action || null,
      credential: first.identifier || (result.responses[0] && result.responses[0].identifier) || null,
      protocol_version: result.protocol_version,
      environment: result.environment || ENV,
      verified_at: new Date().toISOString()
    };
    saveStore(store);
  }
  return json(res, 200, {
    ok: Boolean(portal.success),
    nullifier: nullifier || null,
    credential: first.identifier || null,
    protocol_version: result.protocol_version,
    environment: portal.environment || result.environment || ENV,
    portal: { success: Boolean(portal.success), code: first.code || null, detail: first.detail || null }
  });
}

/* ---------------- server ---------------- */
createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/world/health') {
      return json(res, 200, { ok: true, configured, environment: ENV, rp_id: RP_ID ? RP_ID.slice(0, 8) + '…' : null });
    }
    if (req.method === 'POST' && url.pathname === '/api/world/rp-context') return await handleRpContext(req, res);
    if (req.method === 'POST' && url.pathname === '/api/world/verify') return await handleVerify(req, res);
    return json(res, 404, { error: 'not found' });
  } catch (e) {
    return json(res, 500, { ok: false, error: String(e.message || e) });
  }
}).listen(PORT, () => {
  console.log(`[ohana-world] listening :${PORT} env=${ENV} configured=${configured}`);
  if (!configured) console.log('[ohana-world] set WORLD_APP_ID / WORLD_RP_ID / WORLD_SIGNING_KEY to go live');
});
