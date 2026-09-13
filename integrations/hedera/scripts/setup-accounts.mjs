// LANE D — Hedera testnet account setup.
//
// TWO paths:
//  A) PAYER_ACCOUNT_ID already set (existing funded account) — e.g. Shaka's
//     0.0.10511368. Mirror-checks that it exists + has balance, SKIPS hollow
//     completion entirely, and uses it as payer directly (ED25519 and ECDSA
//     DER hex both accepted — auto-detected).
//  B) No PAYER_ACCOUNT_ID (fresh faucet flow) — completes the hollow payer
//     account (one fee-paying tx signed by its key fixes the missing
//     key-on-record) exactly as before.
// Then: auto-create the receiver via an EVM-alias transfer (~5 tℏ from payer),
// resolve both Account IDs via the mirror, and persist them into .env.
// Idempotent: a receiver already in env + healthy on mirror is kept.
//
// .env stays local-only (gitignored, chmod 600) — keys never leave this disk.
import 'dotenv/config';
import fs from 'node:fs';
import { Client, TransferTransaction, Hbar, PrivateKey, AccountId } from '@hiero-ledger/sdk';

const MIRROR = 'https://testnet.mirrornode.hedera.com';
const HASHSCAN = 'https://hashscan.io/testnet';
const RECEIVER_FUND_HBAR = 5; // ≈5 tℏ to auto-create + fund the receiver

const PAYER_KEY = process.env.PAYER_KEY;
const PAYER_ACCOUNT_ID = (process.env.PAYER_ACCOUNT_ID || '').trim();
const RECEIVER_EVM = process.env.RECEIVER_EVM;
const RECEIVER_ACCOUNT_ID = (process.env.RECEIVER_ACCOUNT_ID || '').trim();

if (!PAYER_KEY || !RECEIVER_EVM) {
  console.error('✗ .env needs PAYER_KEY and RECEIVER_EVM (see .env.example)');
  process.exit(1);
}

// DER hex auto-detect: ED25519 (302e…) and ECDSA (3030…) both fine.
const payerKey = PrivateKey.fromString(PAYER_KEY.replace(/^0x/, ''));
// toEvmAddress() is ECDSA-only — ED25519 keys must come with an explicit id (Path A).
let payerEvm = null;
try { payerEvm = '0x' + payerKey.publicKey.toEvmAddress().toString(); } catch { /* ED25519 → needs PAYER_ACCOUNT_ID */ }
if (payerEvm) console.log('payer EVM alias (from key):', payerEvm);
else console.log('payer key type: ED25519 (EVM derivation n/a)');
console.log('receiver EVM alias        :', RECEIVER_EVM);

async function mirrorGet(path) {
  const r = await fetch(`${MIRROR}${path}`);
  if (!r.ok) return null;
  return r.json();
}

async function lookupByEvm(evm, tries = 12) {
  for (let i = 0; i < tries; i++) {
    const found = await mirrorGet(`/api/v1/accounts/${evm.toLowerCase()}`);
    if (found) return found;
    if (i < tries - 1) {
      console.log(`  … mirror retry ${i + 1}/${tries - 1} (5s)`);
      await new Promise((s) => setTimeout(s, 5000));
    }
  }
  return null;
}

function hbarOf(acc) {
  return (acc?.balance?.balance ?? 0) / 1e8;
}

// ─── 1) resolve payer ───────────────────────────────────────────────────────
let payerId;
if (PAYER_ACCOUNT_ID) {
  // Path A — existing funded account: mirror-check, skip hollow completion.
  const payer = await mirrorGet(`/api/v1/accounts/${PAYER_ACCOUNT_ID}`);
  if (!payer || payer.deleted) {
    console.error(`✗ PAYER_ACCOUNT_ID ${PAYER_ACCOUNT_ID} not found on mirror`);
    process.exit(1);
  }
  payerId = payer.account;
  const balance = hbarOf(payer);
  const keyOnRecord = payer.key ? `${payer.key._type || 'key'}` : 'NO (hollow)';
  console.log(`payer (explicit id) : ${payerId} | balance: ${balance} tℏ | key on record: ${keyOnRecord}`);
  if (balance <= 0) { console.error('✗ PAYER_ACCOUNT_ID has zero balance — fund it first'); process.exit(1); }
  console.log('✓ PAYER_ACCOUNT_ID set → hollow-account completion SKIPPED (existing account, direct use)');
} else {
  // Path B — fresh faucet flow: resolve by EVM alias, then one fee-paying tx
  // completes the hollow account (restores key-on-record so it can sign).
  if (!payerEvm) { console.error('✗ ED25519 payer without PAYER_ACCOUNT_ID is unusable for the faucet path — generate ECDSA keys (npm run genkeys)'); process.exit(1); }
  const payer = await lookupByEvm(payerEvm, 3);
  if (!payer) {
    console.error('✗ no account for payer EVM yet — claim the faucet first:');
    console.error('  https://portal.hedera.com/faucet → paste', payerEvm, '→ Receive testnet HBAR');
    process.exit(1);
  }
  payerId = payer.account;
  console.log(`payer (evm-resolved): ${payerId} | balance: ${hbarOf(payer)} tℏ | key on record: ${payer.key ? 'yes' : 'NO (hollow — will complete now)'}`);
  if (!payer.key) console.log('  hollow payer detected → this transfer signs as fee payer to complete it');
}

const client = Client.forTestnet().setOperator(AccountId.fromString(payerId), payerKey);
const receiverAlias = AccountId.fromEvmAddress(0, 0, RECEIVER_EVM.replace(/^0x/, ''));

// ─── 2) receiver: reuse healthy one, else auto-create via alias transfer ────
let receiverId = null;
if (RECEIVER_ACCOUNT_ID) {
  const existing = await mirrorGet(`/api/v1/accounts/${RECEIVER_ACCOUNT_ID}`);
  if (existing && !existing.deleted) {
    receiverId = existing.account;
    console.log(`✓ receiver reuse     : ${receiverId} | balance: ${hbarOf(existing)} tℏ (idempotent, no transfer)`);
  } else {
    console.log('… RECEIVER_ACCOUNT_ID set in .env but not on mirror — creating a fresh one');
  }
}

if (!receiverId) {
  const amt = new Hbar(RECEIVER_FUND_HBAR);
  console.log(`→ auto-creating receiver: ${RECEIVER_FUND_HBAR} tℏ → alias ${RECEIVER_EVM}`);
  const tx = await new TransferTransaction()
    .addHbarTransfer(AccountId.fromString(payerId), amt.negated())
    .addHbarTransfer(receiverAlias, amt)
    .execute(client);
  const receipt = await tx.getReceipt(client);
  const [tAcc, tRest] = tx.transactionId.toString().split('@');
  const hashscanTx = tRest ? `${tAcc.replace(/\./g, '-')}-${tRest.replace('.', '-')}` : tx.transactionId.toString();
  console.log(`✓ transfer | status: ${receipt.status} | tx: ${tx.transactionId} | ${HASHSCAN}/transaction/${hashscanTx}`);
  const recv = await lookupByEvm(RECEIVER_EVM, 12);
  if (!recv) { console.error('✗ receiver alias not visible on mirror yet — re-run in a minute'); process.exit(1); }
  receiverId = recv.account;
  console.log(`receiver created     : ${receiverId} | balance: ${hbarOf(recv)} tℏ | ${HASHSCAN}/account/${receiverId}`);
}

// ─── 3) persist into .env (local-only, chmod 600) ───────────────────────────
const envPath = new URL('../.env', import.meta.url);
let env = fs.readFileSync(envPath, 'utf8');
if (/^PAYER_ACCOUNT_ID=/m.test(env)) env = env.replace(/^PAYER_ACCOUNT_ID=.*$/m, `PAYER_ACCOUNT_ID=${payerId}`);
else env += `\nPAYER_ACCOUNT_ID=${payerId}`;
if (/^RECEIVER_ACCOUNT_ID=/m.test(env)) env = env.replace(/^RECEIVER_ACCOUNT_ID=.*$/m, `RECEIVER_ACCOUNT_ID=${receiverId}`);
else env += `\nRECEIVER_ACCOUNT_ID=${receiverId}`;
fs.writeFileSync(envPath, env);
fs.chmodSync(envPath, 0o600);
console.log(`✓ .env updated (PAYER_ACCOUNT_ID=${payerId}, RECEIVER_ACCOUNT_ID=${receiverId}), chmod 600`);
console.log(`hashscan payer: ${HASHSCAN}/account/${payerId}`);
client.close(); // SDK holds gRPC handles open — exit cleanly
process.exit(0);
