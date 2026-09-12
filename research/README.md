# Lane E — research notes & sources

Raw sourcing behind the four docs. Everything claims-checked 2026-09-12 (UTC) against primary pages where reachable.

## docs/chainlink.md — hire-quote oracle
- Sepolia ETH/USD proxy `0x694AA1769357215DE4FAC081bf1f309aDC325306` — docs.chain.link/data-feeds/api-reference (constructor example for Sepolia) + ethereum.stackexchange.com/q/146844.
- Sepolia BTC/USD proxy `0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43` — docs.chain.link/data-feeds/getting-started + /using-data-feeds.
- Feed list: docs.chain.link/data-feeds/price-feeds/addresses (JS-rendered; addresses above cited from Chainlink's own code samples).
- Public feeds = free reads; cost = deploy gas only.

## docs/inch.md — BSC settlement
- ETHOnline 2026 prize page: ethglobal.com/events/ethonline2026/prizes — *"Projects that utilize SwapVM will be scored higher… Official Aqua/SwapVM contracts must be used (redeployments of a modified SwapVM contract is allowed)."*
- SwapVM repo: github.com/1inch/swap-vm (strategy composability: _xycSwapXD, fee XD instructions…). Aqua/SwapVM MVP v1.0 audit: openzeppelin.com/news/1inch-aqua-and-swapvm-mvp-v1.0-audit.
- Aggregation API: portal.1inch.dev — `api.1inch.dev/swap/v6.0/{chain}/{quote,swap,approve/…}`, Bearer-key auth; BSC = chain id 56 (community curl examples confirm v6.0/56/swap usage); legacy BSC support since Feb 2021 (1inch blog/Medium).
- Pathfinder splits across PancakeSwap/BiSwap etc. (1inch BSC announcements).

## docs/fetch-bsc.md — honored BNB lane
- agent-launch.ai FAQ/mechanics: bonding curve; 30,000 FET → auto-graduate to PancakeSwap V2, LP burned; no presales/insider pricing.
- Press (May 2026 launch): CryptoBriefing (2 pieces), Benzinga, Markets Insider, Invezz, crypto-news-flash — all consistent on 30k FET graduation + LP burn + BNB Chain.
- Internal canon (sysadmin MEMORY + /shared/kb/creation369/): 4,195 FET flash grant tx 0xac6774a1…c934 (BSC, 2026-05-26) to 0x25965899f4600b3AA5362ee4f34be95E5E62c934 · deploy fee 120 FET (dashboard's "100" is wrong; site+email say 120) · 13 archived agentverse addresses, seed pattern `{name}-creationology369-2026` (May 2026) · budget 1560 deploy / ~500 seeding / ~2135 buffer.

## docs/cardano.md — ninth adapter decision
- "Turbo" name: no public results for Liam+Dankrad+"Turbo" (searched multiple phrasings).
- Liam Horne (ETHGlobal co-founder, ex-OP Labs CEO): liamhorne.com/projects — current work = **Tempo** (tempo.xyz) + rootdata member page.
- Dankrad Feist: theblock.co/post/402271 · forklog.com · finance.yahoo.com · cryptorobotics.ai — left EF (2025) for **Tempo** (Stripe/Paradigm payments L1).
- Tempo facts: tempo.xyz/faq — mainnet live 2026-03-18, chain id 4217, rpc.tempo.xyz; testnet "Moderato" 42431; full EVM via Reth SDK (Foundry/Hardhat OK); stablecoin gas; validators Stripe/Visa/MoneyGram/Zodia Custody; pathUSD TIP-20; **MPP** (mpp.dev) machine-payments standard co-authored by Stripe+Tempo. CEO Matt Huang. Press: CoinDesk 2026-03-18, Ledger Insights, DL News, crypto.news, Everstake/CoinGecko explainers.
- Cardano side: standard eUTXO/Aiken relayer pattern reasoning (no external claims requiring citation beyond Milkomeda's existence as Cardano's EVM sidechain).

## Method note
All four docs written spec-first (specs/whitepaper.html §3 bench doctrine), claims kept to what the sources above support; anything not verifiable tonight is labeled as such inside the doc (esp. the "Turbo" correction — asserted as *most likely* Tempo, never as certain).
