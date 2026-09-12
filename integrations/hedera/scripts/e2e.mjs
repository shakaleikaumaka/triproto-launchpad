// LANE D — E2E runner: boots (mock facilitator if MOCK_FACILITATOR=1) +
// resource server + paying client, prints the transcript, exits with client code.
import 'dotenv/config';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT || 4021);
const MOCK = process.env.MOCK_FACILITATOR === '1';
const MOCK_PORT = Number(process.env.MOCK_PORT || 4402);

const procs = [];
function run(name, args, env = {}) {
  const p = spawn('node', args, { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', (d) => process.stdout.write(`[${name}] ${d}`));
  p.stderr.on('data', (d) => process.stderr.write(`[${name}!] ${d}`));
  procs.push(p);
  return p;
}

async function waitFor(url, tries = 30) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return true; } catch {}
    await new Promise((s) => setTimeout(s, 500));
  }
  return false;
}

const cleanup = (code) => { procs.forEach((p) => p.kill('SIGTERM')); process.exit(code); };
process.on('SIGINT', () => cleanup(130));

if (MOCK) {
  run('mock', ['src/mock-facilitator.mjs'], { MOCK_PORT: String(MOCK_PORT) });
  if (!(await waitFor(`http://localhost:${MOCK_PORT}/supported`))) { console.error('mock never came up'); cleanup(1); }
  console.log('⚠️  MOCK MODE — facilitator is fake, no chain writes\n');
}

run('server', ['src/server.mjs']);
if (!(await waitFor(`http://localhost:${PORT}/health`))) { console.error('server never came up'); cleanup(1); }

// first show the raw 402 challenge (no payment) for the record
const bare = await fetch(`http://localhost:${PORT}/terri`);
console.log(`\n═══ 402 CHALLENGE (no payment) ═══\nHTTP ${bare.status}`);
const pr = bare.headers.get('PAYMENT-REQUIRED');
if (pr) {
  const decoded = JSON.parse(Buffer.from(pr, 'base64').toString('utf8'));
  console.log('PAYMENT-REQUIRED (decoded):', JSON.stringify(decoded.accepts?.[0] ?? decoded, null, 2));
}

const client = run('client', ['src/client.mjs']);
client.on('exit', (code) => cleanup(code ?? 1));
