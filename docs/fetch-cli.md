# Lane SDK — @fetchai/agent-launch-cli integration (SHAKA · PIT · OHANA)

Lane SDK of the tri-proto launchpad. Wraps Fetch.ai's official
`@fetchai/agent-launch-cli@2.0.1` (and its SDK `@fetchai/agent-launch-sdk@0.3.0`,
both **pinned exactly** in `integrations/fetch-cli/package.json`) to automate the
API-side of the cohort token launch on **agent-launch.ai — BSC mainnet (56)**.

Status: 🟢 built · **DRY-RUN GATE ON** · blocked on FET shortfall (14.04 FET)
and zero BNB gas — see Ready-status below.

## 1. SDK trustworthiness audit (CROPS review — performed before any trust)

Verdict: ** trustworthy for the record-creation/handoff flow; reported
concerns below **.

Facts checked (tarballs downloaded and read, not just metadata):

- **Provenance**: published by `web3guru888 <robin@vbrl.ai>` (Robin — our Fetch
  contact), maintainers include `ejfitzgerald`/`efitzgerald` (Edward Fitzgerald,
  Fetch.ai CTO) and `devon.bleibtrey@fetch.ai`. Repository:
  `github.com/fetchai/agent-launch-toolkit`. MIT license. 2.0.0 → 2.0.1 (April
  2026, patch release).
- **Code audit** (both CLI 2.0.1 + SDK 0.3.0 read in full dist form):
  - No `eval`/`new Function`/obfuscation. `child_process` appears only in the
    scaffolder (`create` command: `npm install`, `claude --version`) — we don't
    use `create`.
  - **No private-key exfiltration**: key material (`WALLET_PRIVATE_KEY`) is
    only ever used for local signing via ethers; http.js transports API keys
    (`X-API-Key` / Agentverse `Bearer`) only. Verified by grepping every fetch/
    post call against key-bearing symbols.
  - Hardcoded URLs are all official (agent-launch.ai, agentverse.ai, bscscan,
    bsc-dataseed, plus dev/staging endpoints gated behind `AGENT_LAUNCH_ENV`).
  - Config written to `~/.agentlaunch/config.json` with mode 0600 / dir 0700.
  - Hardcoded contract addresses identified and confirmed sane: FET BEP-20
    `0x031b41e504677879370e9DBcF937283A8691Fa7f`, platform **deployer**
    `0xeDecbC8E118288e1365Db14c9c2f3d51E91Cc247`, BSC USDC
    `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d`, testnet USDC
    `0x64544969ed7EBf5f083679233325356EbE738930`.
- **⚠️ Concern reported (gate ⑦ honesty)**: the CLI ships a **hardcoded shared
  ASI1 API key fallback** in `create.js`
  (`sk_2a3c92a0…[masked]`) used
  when `ASI1_API_KEY` env is unset by scaffolding users. It's a credential baked
  into a public package — poor hygiene, though only affecting the `create`
  scaffolder, which this lane never invokes. Flagged for upstream.
- **⚠️ Additional dependency-tree concern**: `npm install` warns that
  `@cosmjs/crypto@0.32.4` (a CLI dependency) uses `elliptic`, which has known
  security-relevant bugs (upstream cosmjs issue #1708). It is only reachable
  through the CLI's `auth --generate`/cosmos-address path, which this lane
  never executes — still, flagging it for the CROPS review.
- **Design that justifies trust**: `tokenize` = API-side record creation;
  on-chain deployment is **delegated to humans via handoff links**
  (`handoff.js`: "irreversible, 120 FET"). Approve → deploy happens in a human
  MetaMask. Our wrapper automates only the record step and enforces gates.

## 2. Architecture

```
cohort.json  ─┐
              ▼
src/env.mjs (.env, chmod-600 warning) ──► src/preflight.mjs ──► src/deploy-cohort.mjs
   key via env                       read-only RPC:          gates ①②③⑥ → preview
   (never transmitted)              eth_chainId==56           dry-run refuses
                                    FET/BNB balances          --yes → POST /agents/tokenize
                                                              → deployments/bsc.json
                                                              → handoff links for human
```

## 3. Safety gates (all enforced, none optional)

1. **Dry-run default** — refuses to send without an explicit `--yes` flag. The
   preview shows: token name, agent address, chain (56), fee recipient
   (deployer contract `0xeDecbC…Cc247`), fee (120 FET), buffer math, gate
   verdict per token.
2. **Key via env** — `FET_DEPLOYER_KEY` from gitignored, chmod-600 `.env`;
   loader warns if permissions are world/group-readable. The key is used ONLY
   to derive the deployer address locally (ethers). Address-only mode
   (`DEPLOYER_ADDRESS`) needs no key at all.
3. **FET balance gate** — before token i of the planned cohort: balance ≥
   (remaining × 120) + buffer (default 25 FET; `--buffer` / `FET_BUFFER`).
4. **Ledger** — created records land in `deployments/bsc.json` (gitignored).
5. **Logging** — console + `deployments/log.jsonl`; secrets masked with prefix
   only; keys never logged.
6. **Chain gate** — RPC-reported chainId must equal 56, hard abort otherwise.
7. **Human handoff for on-chain** — tool never broadcasts on-chain txs.
   Graduation (30,000 FET → PancakeSwap, LP burned) happens on-chain by the
   platform.

## 4. Cohort config (`cohort.json`)

Fresh agentverse identities derived 2026-09-13 with `uagents`
`Agent(name, seed)` — seeds `{name}-triproto-2026`, per Lane E's checklist
(`docs/fetch-bsc.md`). May-2026 CREATIONology369 addresses stay archived.

| Token  | name                     | address (agentverse)                                   |
| ------ | ------------------------ | ------------------------------------------------------ |
| $SHAKA | SHAKA the Artist Twin    | `agent1qf3d4ha4zg0spm66y9s5cfma52a75vgs6xr4hh6heap0vsxh9yxlc2e80lp` |
| $PIT   | PIT the Consent Conscience | `agent1q0z0wlljcxt2kgeyghx5er9gj4awlag9s8g5femdl5svrwuymvxjw7n8zl3` |
| $OHANA | OHANA All of Us          | `agent1qft6wuyajh57fgwwx4gneywlhwcqx8t95y240s0l6y3cvcj2n5m2k53qt5s` |

Descriptions are honesty-framed per platform law + CROPS doctrine: community
artifacts of an art/coordination project, no yield promises, no investment
framing. `maxWallet: 2` (1% / 10M of 1B cap) as an anti-whale default —
adjustable on Shaka's word.

## 5. Usage

```bash
cd integrations/fetch-cli
npm install
cp .env.example .env && $EDITOR .env && chmod 600 .env
npm run deploy            # dry-run, sends nothing, no secrets needed
npm run deploy:yes        # create records (needs AGENTVERSE_API_KEY)
npm run preflight         # read-only balances only
# partial cohort: node src/deploy-cohort.mjs --max-tokens 2
# machine-readable: add --json to any command
```

## 6. Ready-status (as of 2026-09-13 run)

Preflight against `0x25965899f4600b3AA5362ee4f34be95E5E62c934` (the grant
wallet, canon as the agent-launch deployer):

- Chain: **56 ✅**
- FET: **370.9644 FET**
- BNB: **0.000000 ❌**

Cohort math: 3 × 120 + 25 buffer = **385 FET required**, balance 370.96 →
**SHORT 14.04 FET** (gate ③ blocks a full 3-token run; `--max-tokens 2`
passes: 265 FET). Even with gate-passing FET, the final human handoff step
needs **BNB gas ≈ 0.001–0.005** — currently zero, so no token can complete
on-chain yet either way. Both blockers were pre-existing (BNB = canon blocker
since Aug; FET dropped from 556.86 on Aug 14 → 370.96 now).

Unblock = (a) Shaka tops ≥15 FET and a few $ of BNB into the deployer wallet,
or (b) Shaka blesses a 2-token partial run (`--max-tokens 2`, BNB still
required for the human step), and supplies `AGENTVERSE_API_KEY`.
