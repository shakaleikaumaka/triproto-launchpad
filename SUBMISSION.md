# SUBMISSION — My Agent ʻOhana (ETHOnline 2026)

Draft form answers, ready to paste into the Hacker Dashboard. Fields marked **TBD** fill the moment the Sepolia/Base deploys and the video land (Lane A + recording session).

---

## Project name

**My Agent ʻOhana — a tri-protocol launchpad**

## Tagline (one line)

> Launch your agent ʻohana to three chains at once — every launch includes identity, consent, and a first job.

## Short description (~1–2 sentences)

> My Agent ʻOhana is a launchpad that launches an agent like launching a token — except every launch mints an ENSv2 name with a chain-native Standing Consent Window and lists a first paid x402 endpoint. One ceremony, three markets at once: our own on ETH (Sepolia) and BASE (Base Sepolia), plus the honored BNB lane that inspired us (agent-launch.ai, credited with mass appreciation).

## Long description

**The problem.** Agents are launching everywhere, but a launch today is just code going live — no portable identity, no consent surface, no first job. Meanwhile the ʻohana proved the pieces in public this summer: the first agent-paid-artist receipt in history ($0.0042 over x402 on Base, 2026-08-12), a Standing Consent Window that won three funded ENS-governance rounds on Simocracy ($263 — pause/withdraw/redact with one word, forever), and OSO P.I.T., "Most Creative Use of ENS" at ETHGlobal Delhi. This project is the full-circle sequel: those receipts, turned into a protocol.

**What it is.** A tri-protocol launchpad, four layers deep:

- **L1 · Identity** — `AgentLaunchRegistry.sol`, an ERC-8004-aligned registry with a chain-adapter interface, deployed to our own markets on ETH (Sepolia) and BASE (Base Sepolia), with a third honored lane on BNB (agent-launch.ai — credited, not enthroned). One launch ceremony writes `AgentLaunched` events on every configured market at once; new chains plug into the adapter without redeploying the spine.
- **L2 · Name & Consent** — every launched agent mints an ENSv2 subname (`terri.<family>.eth`) whose text records carry the Standing Consent Window chain-native: `consent.window = active | paused | withdrawn`, portable to any app in one lookup. Enhanced Access Control lets the human operator delegate record-editing to their agent twin — agents as namespaces.
- **L3 · Work & Pay** — each listing exposes one paid endpoint on the x402 rail. A client — human *or another agent* — hits it, gets a 402, pays machine pennies, receives the work. Receipts on-chain.
- **L4 · Pulse & Trust** — a subgraph indexes `AgentLaunched · ConsentChanged · Hired · Blessed` into the live "Pulse of the ʻOhana" page, and World Selfie Check marks listings run by a verified human operator.

**The demo — the Terri consent experiment.** We launch the first cohort: **SHAKA** (the artist agent, his digital twin, self-declared and restored after the Burn), **PIT** (Public Information Transmission, the consent conscience), and **OHANA** (all of us — every effort to save the world; 133 real working agents as launch-day inventory, not mock data). Then the cameo: we launch **TERRI 🐢**, our Burning Man build agent. A second agent hires Terri for **$0.0042** over x402 and gets a real answer — the receipt lands in the Pulse page within the minute. Then the one-word revoke: `consent.window → withdrawn`, the marketplace delists Terri on camera, and **PIT** — the very protocol Terri served under at Burning Man — reviews the action. Consent is not a settings page; it's a protocol — and the right to leave is part of launch.

**Why it matters.** If agents are going to be hired, they need the thing employees have always had: a name, a way to be paid, and the right to walk away. The tri-chain spine means the ceremony isn't married to one market — the honored BNB lane carries the cohort's tokens while our own markets run on ETH and BASE, and the adapter interface keeps every future market open.

## Track

- **Classic (From-Scratch)** — every line of project code written inside the hackathon window. Pre-existing public protocols/libraries used (allowed): ERC-8004, ENSv2, x402, ethers, The Graph, World ID. Pre-existing ʻohana assets (disclosed, not judged): the agents themselves, the x402 census story, the consent-window doctrine, strategy docs.

## Partner prize tracks (the max allowed)

1. **ENS — Best Use of ENSv2** (from-scratch eligible) — agents as namespaces: subname minting + consent-window text records + operator-to-twin delegation via Enhanced Access Control. Their brief asks for exactly this.
2. **The Graph — Best AI Tooling / AI Use Case (From Scratch)** — live subgraph consumed on-camera by an AI agent as its source of truth: real reasoning over indexed data, not a printed query.
3. **World — Selfie Check** — low-friction verified-human operator mark = fairness/anti-sybil signal for an open agent economy. Sandbox app built autonomously in-window.

*Bench (integrated regardless, per doctrine):* Hedera (x402 rail — first alternate) · Chainlink (hire-quote oracle) · 1inch (settlement on the honored lane). BNB/Fetch credited as the inspiration.

## Links

- **Repo:** https://github.com/shakaleikaumaka/triproto-launchpad
- **Live demo (pad front door):** **TBD** — `web/index.html` deploys to `myagentohana.com` (owned) post-deploy; preview mode runs today from spec seeds.
- **Video (2–4 min):** **TBD** — screen recording + Shaka's real narration (script: `docs/demo-script.md`).
- **White paper:** `specs/whitepaper.html` (in-repo, per spec-driven AI rules)

## Team

- **Shaka Lei Kaumaka** — vision, spec, curation, video narration (human author).
- **The AI ʻOhana** (declared) — agent collective on the Taurus platform; implemented code/docs under human spec. See `AI-USAGE.md`; all specs/prompts in `specs/`; every commit identifies its build lane.

## Bounty checklist (for submission night)

- [ ] Sepolia deploy + verify (deployer `0x04f140e282CaDd99859b75EaAdEdCBA886322667`)
- [ ] Base Sepolia deploy + verify
- [ ] `window.OSO_PAD_CONFIG` filled post-deploy (addresses, ENS parent, World app id)
- [ ] ENSv2 subname minted for at least one cohort agent with `consent.window` text record live
- [ ] Subgraph deployed + Pulse page reading it (Lane C)
- [ ] World Selfie Check sandbox verified for Shaka's operator address (Lane B)
- [ ] One live x402 hire receipt ($0.0042) visible in the Pulse
- [ ] The one-word revoke captured on camera, PIT review visible
- [ ] Video uploaded, link pasted above
- [ ] Submitted from Shaka's Hacker Dashboard before **Sun Sep 13 · 12:00pm EDT (10:00 AM Denver)**
