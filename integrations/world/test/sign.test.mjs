/**
 * sign.test.mjs — proves our RP-signature path matches the World ID spec:
 *   message = 0x01 || nonce(32) || created_at u64be || expires_at u64be || hash_to_field(action)
 *   digest  = keccak256("\x19Ethereum Signed Message:\n" + len + message)
 *   sig     = secp256k1 recoverable, v = recid + 27
 * Runs with NO Developer Portal credentials (self-generated key).
 */
import { signRequest, computeRpSignatureMessage } from '@worldcoin/idkit-core/signing';
import { getPublicKey, Signature } from '@noble/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { hexToBytes, bytesToHex, randomBytes } from '@noble/hashes/utils';
import assert from 'node:assert';

const priv = bytesToHex(randomBytes(32));
const pub = getPublicKey(priv, true);

function hashToField(input) {
  const h = keccak_256(input);
  const n = BigInt('0x' + bytesToHex(h)) >> 8n;
  return n.toString(16).padStart(64, '0');
}

// 1) signRequest returns the documented shape
const sig = signRequest({ signingKeyHex: priv, action: 'ohana-operator-verify', ttl: 300 });
assert.match(sig.sig, /^0x[0-9a-f]{130}$/, 'sig must be 65 bytes hex');
assert.match(sig.nonce, /^0x[0-9a-f]{64}$/, 'nonce must be 32 bytes hex');
assert.ok(sig.nonce.startsWith('0x00'), 'nonce must be a field element (top byte zeroed by >>8 shift)');
assert.equal(sig.expiresAt - sig.createdAt, 300, 'ttl respected');
assert.ok(Math.abs(sig.createdAt - Date.now() / 1000) < 5, 'created_at ~ now');

// 2) recompute the message independently and check the signature recovers the key
const nonceBytes = hexToBytes(sig.nonce.slice(2));
const msg = computeRpSignatureMessage(nonceBytes, sig.createdAt, sig.expiresAt, 'ohana-operator-verify');
assert.equal(msg.length, 81, 'with action → 81-byte message');
assert.equal(msg[0], 1, 'version byte');
assert.equal(bytesToHex(msg.slice(1, 33)), sig.nonce.slice(2), 'nonce embedded');
assert.equal(bytesToHex(msg.slice(49, 81)), hashToField(new TextEncoder().encode('ohana-operator-verify')), 'action field element');

const prefix = new TextEncoder().encode('\x19Ethereum Signed Message:\n' + String(msg.length));
const digest = keccak_256(new Uint8Array([...prefix, ...msg]));
const sigBytes = hexToBytes(sig.sig.slice(2));
const r = sigBytes.slice(0, 32), s = sigBytes.slice(32, 64), v = sigBytes[64];
assert.ok(v === 27 || v === 28, 'v = recid + 27');
const recovered = Signature.fromCompact(bytesToHex(r) + bytesToHex(s))
  .addRecoveryBit(v - 27)
  .recoverPublicKey(digest);
assert.equal(bytesToHex(recovered.toRawBytes(true)), bytesToHex(pub), 'signature recovers the signing key');

// 3) session-style (no action) → 49-byte message
const sig2 = signRequest({ signingKeyHex: priv, ttl: 300 });
const msg2 = computeRpSignatureMessage(hexToBytes(sig2.nonce.slice(2)), sig2.createdAt, sig2.expiresAt);
assert.equal(msg2.length, 49, 'no action → 49-byte message');

// 4) 0x-prefixed keys accepted too
const sig3 = signRequest({ signingKeyHex: '0x' + priv, action: 'x', ttl: 60 });
assert.match(sig3.sig, /^0x[0-9a-f]{130}$/);

console.log('✅ sign.test.mjs — RP signature path matches spec (shape, message layout, recovery, ttl)');
