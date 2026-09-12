// Generate two Hedera ECDSA keypairs (payer + receiver) for the .env file.
import { PrivateKey } from '@hiero-ledger/sdk';

function gen(label) {
  const k = PrivateKey.generateECDSA();
  console.log(`${label}_KEY=0x${k.toStringRaw()}`);
  console.log(`${label}_EVM=0x${k.publicKey.toEvmAddress()}`);
}
gen('PAYER');
gen('RECEIVER');
console.log('\n→ paste these into .env, then claim the faucet for PAYER_EVM and run `npm run setup`');
