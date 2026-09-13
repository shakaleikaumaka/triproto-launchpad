// LANE D — Hedera x402 rail · PAYING CLIENT (the "agent")
// Completes one real paid request: hits the gated /terri endpoint, receives the
// 402 challenge, signs a Hedera TransferTransaction with the payer key, retries
// with the payment payload; the facilitator (Blocky402) verifies + settles
// on-chain; the answer is served. Prints the full proof.
import 'dotenv/config';
import { wrapFetchWithPayment } from '@x402/fetch';
import { x402Client, x402HTTPClient } from '@x402/core/client';
import { ExactHederaScheme } from '@x402/hedera/exact/client';
import { createClientHederaSigner, PrivateKey } from '@x402/hedera';

const URL_ = process.env.TARGET_URL || `http://localhost:${process.env.PORT || 4021}/terri`;
const NETWORK = process.env.HEDERA_NETWORK || 'hedera:testnet';

const PAYER_ACCOUNT_ID = process.env.PAYER_ACCOUNT_ID;
const PAYER_KEY = process.env.PAYER_KEY;

if (!PAYER_ACCOUNT_ID || !PAYER_KEY) {
  console.error('✗ PAYER_ACCOUNT_ID / PAYER_KEY missing — run `npm run setup` first.');
  process.exit(1);
}

// DER hex auto-detect: ED25519 (302e…) and ECDSA (3030…) both accepted —
// the payer can be any funded testnet account, not only an ECDSA faucet key.
const signer = createClientHederaSigner(
  PAYER_ACCOUNT_ID,
  PrivateKey.fromString(PAYER_KEY.replace(/^0x/, '')),
  { network: NETWORK },
);

// HBAR (asset '0.0.0') is a non-default asset → opt it in with a per-payment cap.
// NOTE: x402Client's constructor takes a selector fn, NOT config — use fromConfig.
const client = x402Client.fromConfig({
  schemes: [{ network: 'hedera:*', client: new ExactHederaScheme(signer) }],
  spendControls: {
    allowedAssets: [{ network: NETWORK, asset: '0.0.0', maxAmountPerPayment: '1000000' }], // ≤0.01 ℏ/request
  },
});
const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const httpClient = new x402HTTPClient(client);

console.log(`🤖 paying client: ${PAYER_ACCOUNT_ID} → GET ${URL_}`);
const t0 = Date.now();
const res = await fetchWithPayment(URL_, { method: 'GET' });
const ms = Date.now() - t0;

const body = await res.json().catch(() => null);
console.log(`\nHTTP ${res.status} in ${ms}ms`);
console.log('response body:', JSON.stringify(body, null, 2));

const settlement = httpClient.getPaymentSettleResponse((name) => res.headers.get(name));
if (settlement) {
  console.log('\n═══ x402 SETTLEMENT ═══');
  console.log('  success    :', settlement.success);
  console.log('  transaction:', settlement.transaction);
  console.log('  network    :', settlement.network);
  console.log('  payer      :', settlement.payer);
  if (settlement.transaction && NETWORK === 'hedera:testnet') {
    const [acc, rest] = String(settlement.transaction).split('@');
    console.log('  hashscan   : https://hashscan.io/testnet/transaction/' + (rest ? `${acc.replace(/\./g, '-')}-${rest.replace('.', '-')}` : settlement.transaction));
  }
} else {
  console.log('\n(no settlement header — did the request actually pay?)');
}

process.exit(res.ok ? 0 : 1);
