// ═══════════════════════════════════════════════════════════════════════════
// ⚠️⚠️⚠️  MOCK FACILITATOR — FOR OFFLINE DEMOS ONLY  ⚠️⚠️⚠️
// This is NOT Blocky402 and NOT a real x402 facilitator. It speaks the same
// HTTP shape (/supported, /verify, /settle) so the server+client plumbing can
// be demoed with NO network and NO chain. NOTHING is verified or settled —
// every payload is "accepted", the transaction id is fabricated and labeled.
// Real E2E = MOCK_FACILITATOR unset → https://api.testnet.blocky402.com.
// ═══════════════════════════════════════════════════════════════════════════
import express from 'express';

const PORT = Number(process.env.MOCK_PORT || 4402);
const app = express();
app.use(express.json({ limit: '2mb' }));

// feePayer must be a syntactically-valid entity id (the client builds a real
// TransferTransaction with it). 0.0.7162784 is Blocky402's real testnet fee
// payer — reused here only so the tx assembles; the mock NEVER co-signs or
// submits anything. Settlement output stays labeled 0.0.MOCK@… below.
app.get('/supported', (_req, res) => res.json({
  kinds: [{ x402Version: 2, scheme: 'exact', network: 'hedera:testnet', extra: { feePayer: '0.0.7162784' } }],
  extensions: [],
  signers: { 'hedera:*': ['0.0.7162784'] },
  mock: true,
}));

app.post('/verify', (req, res) => {
  const ok = !!(req.body?.paymentPayload && req.body?.paymentRequirements);
  res.json({ isValid: ok, payer: '0.0.MOCK-PAYER', invalidReason: ok ? undefined : 'mock: missing fields', mock: true });
});

app.post('/settle', (_req, res) => {
  const now = Date.now();
  res.json({
    success: true,
    transaction: `0.0.MOCK@${Math.floor(now / 1000)}.${(now % 1000) * 1e6}`, // fabricated, labeled
    network: 'hedera:testnet',
    payer: '0.0.MOCK-PAYER',
    mock: true,
    warning: 'MOCK SETTLEMENT — nothing touched any blockchain',
  });
});

app.listen(PORT, () => console.log(`⚠️  MOCK facilitator on :${PORT} — NOT real, no chain writes`));
