// LANE D — Hedera x402 rail · RESOURCE SERVER
// A tiny x402-gated endpoint serving a canned "Terri the Turtle" camp-ops answer.
// Payment: x402 v2 `exact` scheme on hedera:testnet, settled via the Blocky402
// facilitator (https://api.testnet.blocky402.com) — or a clearly-labeled local
// MOCK facilitator when MOCK_FACILITATOR=1 (offline demos only, no chain writes).
import 'dotenv/config';
import express from 'express';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactHederaScheme } from '@x402/hedera/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';

const PORT = Number(process.env.PORT || 4021);
const PAY_TO = process.env.RECEIVER_ACCOUNT_ID; // merchant wallet (receives the payment)
const NETWORK = process.env.HEDERA_NETWORK || 'hedera:testnet';
const FACILITATOR_URL = process.env.MOCK_FACILITATOR === '1'
  ? (process.env.MOCK_FACILITATOR_URL || 'http://localhost:4402')
  : (process.env.FACILITATOR_URL || 'https://api.testnet.blocky402.com');
const PRICE_TINYBARS = process.env.PRICE_TINYBARS || '100000'; // 100,000 tinybar = 0.001 HBAR

if (!PAY_TO) {
  console.error('✗ RECEIVER_ACCOUNT_ID missing — run `npm run setup` first (see README).');
  process.exit(1);
}

// The canned resource being sold: Terri the Turtle answers one camp-ops question.
// (In the launchpad demo this stands in for any agent answer behind a paywall.)
const TERRI_ANSWER = {
  agent: 'Terri 🐢 (Terrible Turtle Camp assistant)',
  question: 'where is the cooking oil?',
  answer:
    '🐢 Cooking oil lives in the KITCHEN BINS under the semi-truck shade — ' +
    'olive oil + sprays + seasonings are secured with Chef Marcus\'s kit. ' +
    'Keep everything in the kitchen zone, and ask before moving chef tools. Aloha! 🤙',
  source: 'turtle-bins board · kitchenUpdates lane',
};

const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitator)
  .register(NETWORK, new ExactHederaScheme());

const app = express();
app.use(express.json());

// Free endpoints
app.get('/health', (_req, res) => res.json({ ok: true, lane: 'D', network: NETWORK, facilitator: FACILITATOR_URL, mock: process.env.MOCK_FACILITATOR === '1' }));
app.get('/', (_req, res) => res.json({
  service: 'lane-d hedera x402 demo endpoint',
  paid: 'GET /terri — x402-gated (0.001 tHBAR via ' + FACILITATOR_URL + ')',
  free: ['GET /health'],
}));

// Paid endpoint — the middleware issues the 402 challenge, verifies the payment
// with the facilitator, and settles on-chain before this handler runs.
app.use(
  paymentMiddleware(
    {
      'GET /terri': {
        accepts: {
          scheme: 'exact',
          price: { amount: PRICE_TINYBARS, asset: '0.0.0' }, // HBAR, in tinybars
          network: NETWORK,
          payTo: PAY_TO,
        },
        description: 'Ask Terri one camp-ops question (x402 exact, HBAR on ' + NETWORK + ')',
      },
    },
    resourceServer,
  ),
);

app.get('/terri', (req, res) => {
  res.json({
    ...TERRI_ANSWER,
    paid: true,
    price: { amount: PRICE_TINYBARS, unit: 'tinybar', hbar: Number(PRICE_TINYBARS) / 1e8 },
    network: NETWORK,
    payTo: PAY_TO,
    facilitator: FACILITATOR_URL,
    note: 'Payment verified + settled by the x402 facilitator before this response was served.',
  });
});

app.listen(PORT, () => {
  console.log(`🐢 lane-d resource server on :${PORT}`);
  console.log(`   paid endpoint : GET http://localhost:${PORT}/terri  (${PRICE_TINYBARS} tinybar on ${NETWORK})`);
  console.log(`   payTo (merchant): ${PAY_TO}`);
  console.log(`   facilitator   : ${FACILITATOR_URL}${process.env.MOCK_FACILITATOR === '1' ? '  ⚠️ MOCK — no real settlement' : ''}`);
});
