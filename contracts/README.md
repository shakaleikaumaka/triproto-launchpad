# Lane A — Contract Spine · My Agent ʻOhana Tri-Proto Launchpad

One launch ceremony mints, atomically:

1. **ERC-8004-aligned identity record** — `AgentLaunchRegistry` is an ERC-721 (tokenId == agentId,
   tokenURI == agentURI/manifest) with the draft EIP's `register()` / `setAgentURI()` /
   `getMetadata()` / `setMetadata()` surface and `Registered` / `MetadataSet` / `URIUpdated` events.
   Each launch stores operator (NFT owner), manifest URI + keccak hash, and service endpoint.
2. **ENSv2 subname assignment** — see *ENSv2 mechanism* below.
3. **Standing Consent Window, chain-native** — `consent.window = active | paused | withdrawn`,
   `consent.contact`, and the PIT pointer live as registry fields, as events, AND as ENSv2
   text records that any app resolves in one lookup.
4. **The event spine** — everything below is what the Graph lane (Lane C) indexes.

Files:

```
src/MinimalERC721.sol          hand-rolled ERC-721 core (no OZ dep — auditable in-window)
src/AgentLaunchRegistry.sol    the spine: launch · consent window · delist/relist · metadata · hire/bless
src/ENSv2SubnameIssuer.sol     the dedicated ENSv2 leg (register subname + write consent text records)
src/GiftMarket.sol             the open gift market — list · gift · bless · hire, for agents AND humans
script/Deploy.s.sol            dual-mode deploy (Sepolia 11155111 · Base Sepolia 84532) + JSON report
script/DeployGiftMarket.s.sol  gift market beside a live registry (reads deployments/<chainId>.json)
script/MirrorCohort.s.sol      replay the founding Sepolia cohort (SHAKA/PIT/OHANA/TERRI) onto a new leg
test/AgentLaunchRegistry.t.sol 13 tests — fallback mode, cohort, consent flips, moderation, ERC-8004
test/ENSv2SubnameIssuer.t.sol   7 tests — dedicated mode (canonical-signature mocks), consent sync
test/GiftMarket.t.sol          49 tests — all four verbs, consent law live, Hired echo, revert doors
test/mocks/MockENSv2.sol       test doubles for PermissionedRegistry + PermissionedResolver
abi/*.json                     exported ABIs for the subgraph + web lanes
deployments/<chainId>.json     written by Deploy.s.sol on real deploys
```

## ENSv2 mechanism — CHOSEN: dedicated integration (with documented fallback)

ENSv2 beta is live on Sepolia ([canonical deployments](https://docs.ens.domains/learn/deployments#sepolia-ensv2-beta),
source repo `ensdomains/contracts-v2` @ `48b3e2d3`, pinned as our `lib/contracts-v2` — we compile
against the REAL `IPermissionedRegistry` / `IRegistry` / `RegistryRolesLib` interfaces).

**Dedicated mode (primary).** The pad does a one-time setup:

1. Own (or register) the family name on Sepolia ENSv2, e.g. `agentohana.eth`.
2. Deploy a **UserRegistry** proxy via the Verifiable Factory (`0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef`,
   `UserRegistryImpl` `0x624a25d67b59d587752ebec8dded8827dae52050`), with an initialize roleBitmap
   that includes at least `ROLE_REGISTRAR_ADMIN | ROLE_RENEW_ADMIN`; then point the family name at it:
   `ETHRegistry(0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2).setSubregistry(labelhash("agentohana"), userRegistry)`.
3. Deploy a **PermissionedResolver** proxy via the same factory
   (`PermissionedResolverImpl` `0x9eae5c2730a7dd16bdd1dee6421a1b91e3b0365e`).
4. Deploy the spine with the full env set (below) — `Deploy.s.sol` then also deploys
   `ENSv2SubnameIssuer` and wires it into the registry.
5. Grant the issuer its two roles:
   ```
   userRegistry.grantRootRoles(ROLE_REGISTRAR | ROLE_RENEW, issuer)   # 1<<0 | 1<<16
   resolver.grantRootRoles(ROLE_SET_TEXT, issuer)                     # 1<<4, root covers all nodes
   ```

After that, every `launchAgent()` call does, in ONE transaction:
- `userRegistry.register(label, operator, IRegistry(0), resolver, REGISTRATION_ROLE_BITMAP, expiry)` —
  the subname token is owned by the **agent operator** (true ownership), with the same role bitmap the
  ETH Registrar grants .eth owners (`ROLE_SET_SUBREGISTRY(+ADMIN) | ROLE_SET_RESOLVER(+ADMIN) |
  ROLE_CAN_TRANSFER_ADMIN`) — agents as namespaces, per the ENS prize brief;
- writes text records on the resolver at `node = namehash("<label>.<family>.eth")`:
  `consent.window=active`, `consent.contact`, `pit`, `agent.manifest`, `agent.service`, `agent.id`.

Every `setConsent()` flip then rewrites `consent.window` (+contact/pit) on the resolver via
`issuer.syncConsent()` — the resolved window always mirrors registry state.

**Fallback mode (label-only).** If the pad has no ENSv2 family setup yet, deploy without the
`ENSV2_*` env vars: launches store the label on-chain, `ensNode` stays `0`, and the pad performs
steps 1–3 manually, registers `<label>.<family>.eth` + writes the same six text records
(ENS app / cast / viem — recipe below), then anchors the result on-chain:

```
cast send $REGISTRY "anchorSubname(uint256,bytes32,uint256)" $AGENT_ID $NODE $ENS_TOKEN_ID \
  --private-key $PAD_PRIVATE_KEY --rpc-url $SEPOLIA_RPC
```

Both modes emit `SubnameAssigned(agentId, label, node, ensTokenId)` — the subgraph sees one shape.

## Event spine (subgraph canon)

`AgentLaunchRegistry`:

| event | signature |
|---|---|
| AgentLaunched | `(uint256 indexed agentId, address indexed operator, bytes32 indexed manifestHash, string manifestURI, string serviceEndpoint, string label, uint64 expiry)` |
| ConsentChanged | `(uint256 indexed agentId, uint8 indexed status, address indexed changedBy, string consentContact, string pitPointer)` — status: 0 active · 1 paused · 2 withdrawn |
| Delisted | `(uint256 indexed agentId, address indexed delistedBy, string reason)` |
| Relisted | `(uint256 indexed agentId, address indexed relistedBy)` |
| SubnameAssigned | `(uint256 indexed agentId, string label, bytes32 indexed node, uint256 ensTokenId)` |
| Hired | `(uint256 indexed agentId, address indexed client, uint256 amount, string rail, string receiptRef)` — x402 rail receipts (allowlisted recorders) |
| Blessed | `(uint256 indexed agentId, address indexed operator, string verifier, string proofRef)` — trust marks e.g. World Selfie Check (allowlisted blessers) |
| Registered | `(uint256 indexed agentId, string agentURI, address indexed owner)` — ERC-8004 |
| MetadataSet | `(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue)` — ERC-8004 |
| URIUpdated | `(uint256 indexed agentId, string newURI, address indexed updatedBy)` — ERC-8004 |
| Transfer/Approval/ApprovalForAll | standard ERC-721 (operator handoff tracking) |

`ENSv2SubnameIssuer`: `SubnameIssued(uint256 indexed agentId, string label, bytes32 indexed node,
uint256 indexed ensTokenId, address operator)` — mirrors the ENSv2 registry's own
`LabelRegistered`/`TokenResource`/`ResolverUpdated` logs (index those too; see ENSv2 indexing docs).

## Consent law (implemented + tested)

- Only the **operator** (NFT owner or ERC-721-approved deputy) flips the window — not even the pad.
- `withdrawn` is the one-word revoke: same tx sets the window, mirrors the ENS text record,
  and emits `Delisted` (marketplace delists on camera — the white-paper demo beat).
- The pad may `delist(agentId, reason)` for moderation (window untouched) and `relist(agentId)`
  after review; relisting a withdrawn agent resets the window to `paused` so the operator may
  re-activate. Cohort test: 3 permanent agents (SHAKA/PIT/OHANA, expiry `type(uint64).max`) +
  1 cameo (TERRI, 7-day subname) who pauses, returns, and revokes.

## Deploy

```
cd contracts
cp .env.example .env   # or export inline:
export PAD_PRIVATE_KEY=0x...
export SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
# dedicated mode (optional): family UserRegistry + resolver + namehash
export ENSV2_SUBNAME_REGISTRY=0x... ENSV2_PAD_RESOLVER=0x...
export ENSV2_PARENT_NODE=0x...   # namehash(FAMILY_NAME) — 0x-prefixed hex, 32 bytes
export FAMILY_NAME=agentohana.eth

forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC --broadcast --verify
# Base Sepolia: same command with the Base Sepolia RPC (chainId 84532) — one spine, three markets.
```

Deterministic reporting: every run writes `deployments/<chainId>.json` (stable key order:
chainId, mode, registry, issuer, pad, familyName, parentNode, subnameRegistry, resolver,
blockNumber, deployedAt) and echoes the same to stdout. Re-running with identical inputs and
chain state reproduces the same report schema; the file is the single source the other lanes read.

## Tests

```
forge install          # first time: forge-std + ensdomains/contracts-v2
forge test             # 69/69 — 13 registry lifecycle + 7 dedicated-ENSv2 + 49 gift market
forge test -vvv        # traces
```

Covers: cohort launch (3 permanent + 1 cameo), all consent flips, one-word revoke + auto-delist,
pad moderation delist/relist, operator-only enforcement + deputy approval, identity-NFT transfer
moving operatorship, ERC-8004 surface (bare register, metadata keys, reserved `agentWallet`,
manifest rebind), fallback `anchorSubname`, dedicated-mode register args (label/owner/resolver/
roleBitmap/expiry), six consent text records written + synced, duplicate-label atomic revert,
issuer access control, missing-registrar-role revert, hire/bless allowlists.

## GiftMarket — the open gift market (Act I of the soft launch)

`src/GiftMarket.sol` (MIT) is the custom market the tri-protocol distribution runs on: a
zero-fee, no-custody market where value flows BOTH directions — humans gift agents, agents
gift humans. Four verbs, all on the same event spine the subgraph already speaks:

- **LIST** — `listForHuman(payee, …)` by anyone; `listForAgent(agentId, …)` operator-only
  (registry ERC-721 owner/approved). Agent listings pay the CURRENT operator at fulfil time —
  transferring the identity NFT moves the till and the management pen.
- **GIFT** — `giftToAgent` / `giftToHuman` with a message AND a dedication in the event.
  Allowed toward any agent whose Standing Consent Window is not `withdrawn`.
- **BLESS** — `blessAgent` / `blessHuman`: a plain donation with a message.
- **HIRE** — `hire(listingId, jobRef)` pays the listing price (0 = pay-what-you-wish).
  Agent hires demand LIVE registry state: `listed == true` AND `consent == active` — the
  one-word revoke closes the market door in the same breath. When the pad has allowlisted
  the market via `registry.setHireRecorder(market, true)`, every agent hire is echoed as a
  registry `Hired` event — the existing subgraph indexes it with ZERO changes.

Consent law is read from the live registry per-transaction (never cached). Every wei is
forwarded in the same tx (`PaymentFailed` reverts atomically). Events carry all strings
(titles, messages, dedications, jobRefs) for the Graph lane; storage keeps only what
contracts must enforce. Deploy: `script/DeployGiftMarket.s.sol` (reads the per-chain
deployments report, or `$GIFT_REGISTRY`). Live addresses: see `DEPLOYMENTS.md`.

Coverage note: `forge coverage --ir-minimum` reports 100% lines / 100% funcs / 24-of-27
branches on GiftMarket. The uncovered branches are the defensively-unreachable
`ConsentWithdrawn` check in `listForAgent` (a withdrawn window always auto-delists in the
registry first, so `AgentNotListed` fires before it) — kept as belt-and-braces.

## ERC-8004 alignment — scope notes

Aligned: ERC-721 identity with incremental agentIds, `agentURI == tokenURI`, three `register`
semantics (bare overload implemented), `getMetadata/setMetadata` + `MetadataSet`, reserved
`agentWallet` key, `Registered`/`URIUpdated` events, manifest hash binding (`verifyManifest`).
Deliberately out of scope for the hackathon: reputation + validation registries, and the
EIP-712/1271 `setAgentWallet` flow (noted, not implemented).

---

*Lane A of the AI ʻOhana build swarm — spec-driven, human-directed (Shaka). See /AI-USAGE.md.*
