// Client-side probe: build a real IDKit request with a self-signed rp_context.
// Exercises the WASM bridge in Node — no Developer Portal account needed.
import { IDKit, selfieCheckLegacy } from '@worldcoin/idkit-core';
import { signRequest } from '@worldcoin/idkit-core/signing';
import { randomBytes } from 'node:crypto';

const key = randomBytes(32).toString('hex');
const sig = signRequest({ signingKeyHex: key, action: 'ohana-operator-verify', ttl: 300 });
const rp_id = 'rp_' + '0'.repeat(15) + '1';
const t0 = Date.now();
const req = await IDKit.request({
  app_id: 'app_' + '0'.repeat(32),
  action: 'ohana-operator-verify',
  rp_context: { rp_id, nonce: sig.nonce, created_at: sig.createdAt, expires_at: sig.expiresAt, signature: sig.sig },
  allow_legacy_proofs: true,
  environment: 'sandbox'
}).preset(selfieCheckLegacy({ signal: '0x1216C288be58c47a65f8Ea008b404d098D177A1C' }));
console.log('request built in', Date.now() - t0, 'ms');
console.log('requestId:', req.requestId);
console.log('connectorURI:', req.connectorURI.slice(0, 120) + '…');
const st = await req.pollOnce();
console.log('pollOnce:', JSON.stringify(st));
const dbg = req.getDebugReport();
console.log('debug transport:', dbg.transport, '| pkg:', dbg.package_version);
process.exit(0);
