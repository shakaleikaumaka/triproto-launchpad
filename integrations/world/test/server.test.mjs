/**
 * server.test.mjs — end-to-end tests of server.mjs with DUMMY credentials.
 * No Developer Portal account needed. Covers: health, rp-context shape,
 * malformed/mismatch rejects, local replay guard, and a live probe of how the
 * production verify endpoint answers an unregistered RP (documented in docs/world.md).
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { rmSync } from 'node:fs';
import assert from 'node:assert';

const PORT = 8471;
const BASE = `http://localhost:${PORT}`;
const STORE = new URL('./nullifiers.test.json', import.meta.url).pathname;
const KEY = randomBytes(32).toString('hex');

function start(env) {
  const p = spawn('node', ['server.mjs'], {
    env: { ...process.env, PORT: String(PORT), WORLD_STORE: STORE, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return new Promise((resolve) => {
    p.stdout.on('data', (d) => { if (String(d).includes('listening')) resolve(p); });
  });
}
const post = (path, body) => fetch(BASE + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
}).then(async (r) => ({ status: r.status, body: await r.json() }));

rmSync(STORE, { force: true });

/* ---- unconfigured server fails closed ---- */
let srv = await start({});
let h = await fetch(BASE + '/api/world/health').then((r) => r.json());
assert.equal(h.configured, false, 'unconfigured health');
let r = await post('/api/world/rp-context', { action: 'x' });
assert.equal(r.status, 503, 'rp-context 503 when unconfigured');
srv.kill();
await new Promise((r2) => setTimeout(r2, 300));

/* ---- configured server ---- */
srv = await start({ WORLD_APP_ID: 'app_dummy_laneb', WORLD_RP_ID: 'rp_dummy_laneb', WORLD_SIGNING_KEY: KEY, WORLD_ENV: 'sandbox' });
h = await fetch(BASE + '/api/world/health').then((r2) => r2.json());
assert.equal(h.ok, true); assert.equal(h.configured, true); assert.equal(h.environment, 'sandbox');

// rp-context: fresh signed context per request
r = await post('/api/world/rp-context', { action: 'ohana-operator-verify' });
assert.equal(r.status, 200);
const { rp_id, sig, nonce, created_at, expires_at } = r.body;
assert.equal(rp_id, 'rp_dummy_laneb');
assert.match(sig, /^0x[0-9a-f]{130}$/);
assert.match(nonce, /^0x00[0-9a-f]{62}$/);
assert.equal(expires_at - created_at, 300);
const r2b = await post('/api/world/rp-context', { action: 'ohana-operator-verify' });
assert.notEqual(r2b.body.nonce, nonce, 'fresh nonce per request (duplicate_nonce protection)');

// verify: malformed
r = await post('/api/world/verify', { result: null });
assert.equal(r.status, 400); assert.equal(r.body.code, 'malformed_request');

// verify: action mismatch
r = await post('/api/world/verify', {
  result: { protocol_version: '3.0', nonce: '0x00', action: 'other-action', responses: [{ nullifier: '0x0abc' }] },
  action: 'ohana-operator-verify'
});
assert.equal(r.status, 400); assert.equal(r.body.code, 'action_mismatch');

// verify: live probe — unregistered RP vs production portal (expected reject)
r = await post('/api/world/verify', {
  result: {
    protocol_version: '3.0', nonce: '0x00dead', action: 'ohana-operator-verify', environment: 'sandbox',
    responses: [{ identifier: 'selfie', nullifier: '0x00beef', merkle_root: '0x00', proof: '0x00', signal_hash: '0x00' }]
  },
  action: 'ohana-operator-verify'
});
console.log('   portal probe (unregistered rp):', JSON.stringify(r.body));
assert.equal(r.body.ok, false, 'unregistered RP must not verify');

// replay guard: pre-seeded nullifier short-circuits BEFORE the portal
const { writeFileSync } = await import('node:fs');
writeFileSync(STORE, JSON.stringify({ '0x00beef': { action: 'ohana-operator-verify', credential: 'selfie', verified_at: '2026-09-12T00:00:00Z' } }));
r = await post('/api/world/verify', {
  result: {
    protocol_version: '3.0', nonce: '0x00dead', action: 'ohana-operator-verify', environment: 'sandbox',
    responses: [{ identifier: 'selfie', nullifier: '0x00beef', merkle_root: '0x00', proof: '0x00', signal_hash: '0x00' }]
  },
  action: 'ohana-operator-verify'
});
assert.equal(r.body.ok, true); assert.equal(r.body.already, true, 'replay guard returns already=true');
assert.equal(r.body.nullifier, '0x00beef');

srv.kill();
rmSync(STORE, { force: true });
console.log('✅ server.test.mjs — health, rp-context, malformed/mismatch, portal probe, replay guard');
