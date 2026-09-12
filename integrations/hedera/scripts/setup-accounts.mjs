// LANE D — Hedera testnet account setup.
// The portal faucet (https://portal.hedera.com/faucet) auto-creates a HOLLOW
// account when you paste an EVM address: it has an Account ID + the EVM alias
// but no key on record yet, so it cannot SEND funds until "completed". This
// script completes the payer account (one fee-paying tx signed by its key) and
// auto-creates the receiver account in the same transfer, then writes both
// Account IDs into .env.
//
// Prereq: paste PAYER_EVM at https://portal.hedera.com/faucet once (10 tℏ/day anon).
import 'dotenv/config';
import fs from 'node:fs';
import { Client, TransferTransaction, Hbar, PrivateKey, AccountId } from '@hiero-ledger/sdk';

const MIRROR = 'https://testnet.mirrornode.hedera.com';
const PAYER_KEY = process.env.PAYER_KEY;
const RECEIVER_EVM = process.env.RECEIVER_EVM;

if (!PAYER_KEY || !RECEIVER_EVM) {
  console.error('✗ .env needs PAYER_KEY and RECEIVER_EVM (see .env.example)');
  process.exit(1);
}

const payerKey = PrivateKey.fromStringECDSA(PAYER_KEY);
const payerEvm = '0x' + payerKey.publicKey.toEvmAddress();
console.log('payer EVM alias   :', payerEvm);
console.log('receiver EVM alias:', RECEIVER_EVM);

async function lookupByEvm(evm, tries = 12) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(`${MIRROR}/api/v1/accounts/${evm}`);
    if (r.ok) return r.json();
    if (i < tries - 1) await new Promise((s) => setTimeout(s, 5000));
  }
  return null;
}

// 1) resolve payer account id (faucet must have run first)
let payer = await lookupByEvm(payerEvm, 3);
if (!payer) {
  console.error('✗ no account for payer EVM yet — claim the faucet first:');
  console.error('  https://portal.hedera.com/faucet → paste', payerEvm, '→ Receive 10 testnet HBAR');
  process.exit(1);
}
const payerId = payer.account;
console.log('payer account id  :', payerId, '| balance:', (payer.balance?.balance ?? 0) / 1e8, 'tℏ', '| key on record:', payer.key ? 'yes' : 'NO (hollow)');

// 2) one transfer: payer (fee payer → completes hollow account) → receiver alias (auto-creates receiver)
const client = Client.forTestnet().setOperator(AccountId.fromString(payerId), payerKey);
const receiverAlias = AccountId.fromEvmAddress(0, 0, RECEIVER_EVM.replace(/^0x/, ''));

const already = payer.key ? ' (already completed)' : '';
const amt = payer.key ? new Hbar(0.01) : new Hbar(1); // hollow path funds receiver with 1 tℏ

const tx = await new TransferTransaction()
  .addHbarTransfer(AccountId.fromString(payerId), amt.negated())
  .addHbarTransfer(receiverAlias, amt)
  .execute(client);
const receipt = await tx.getReceipt(client);
console.log(`✓ transfer ${amt.toString()} payer → receiver alias${already} | status: ${receipt.status} | tx: ${tx.transactionId}`);

// 3) resolve receiver account id
const recv = await lookupByEvm(RECEIVER_EVM, 12);
if (!recv) { console.error('✗ receiver alias not visible on mirror yet — re-run in a minute'); process.exit(1); }
const receiverId = recv.account;
console.log('receiver account id:', receiverId, '| balance:', (recv.balance?.balance ?? 0) / 1e8, 'tℏ');

// 4) persist into .env
const envPath = new URL('../.env', import.meta.url);
let env = fs.readFileSync(envPath, 'utf8');
env = env.replace(/^PAYER_ACCOUNT_ID=.*$/m, `PAYER_ACCOUNT_ID=${payerId}`);
env = env.replace(/^RECEIVER_ACCOUNT_ID=.*$/m, `RECEIVER_ACCOUNT_ID=${receiverId}`);
fs.writeFileSync(envPath, env);
console.log('✓ .env updated (PAYER_ACCOUNT_ID, RECEIVER_ACCOUNT_ID)');
console.log('hashscan: https://hashscan.io/testnet/account/' + payerId);
