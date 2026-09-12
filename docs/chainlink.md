# Chainlink — Hire-Quote Oracle (bench track)

Lane E research doc · 2026-09-12 · status: integrated-as-bench (per spec §3, Chainlink is not on the submitted slate; this doc keeps the door open at minimum cost)

## The job

The pad's hire flow quotes work in **USD machine pennies** (the canon: one camp answer = $0.0042), but settlement on our own markets is in ETH (Sepolia) / ETH (Base Sepolia). Something has to convert *"this listing costs $0.0042"* → *"send N wei"* at hire time. That something is the **hire-quote oracle**: one read of Chainlink's public ETH/USD feed.

This is the cheapest honest use of Chainlink that is still *real*: a production data feed, consumed on-chain, by a contract we wrote tonight.

## Feeds that exist on Sepolia (verified against Chainlink docs)

| Pair | Proxy address (Sepolia) | Decimals | Source |
|---|---|---|---|
| ETH/USD | `0x694AA1769357215DE4FAC081bf1f309aDC325306` | 8 | docs.chain.link data-feeds API reference |
| BTC/USD | `0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43` | 8 | docs.chain.link "Consuming Data Feeds" |

More Sepolia pairs (LINK/USD, USDC/USD, DAI/USD…) are listed on the docs addresses page; ETH/USD is the only one the hire-quote path needs. Public data feeds are **free to read** — no LINK billing, no upkeep, no subscription. Cost of the whole feature = a few cents of Sepolia gas to deploy.

## Consumer pattern (tiny)

One interface, one view function, staleness guard:

```solidity
// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.24;

import {AggregatorV3Interface} from
    "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/// @notice Hire-quote oracle: converts a USD-penny quote into wei at the live ETH/USD feed.
contract HireQuoteOracle {
    AggregatorV3Interface public immutable feed; // Sepolia ETH/USD
    uint256 public constant MAX_STALENESS = 1 days; // Sepolia heartbeats are slow; document it

    constructor() {
        feed = AggregatorV3Interface(0x694AA1769357215DE4FAC081bf1f309aDC325306);
    }

    /// @param usdE6 quote in USD with 6 decimals ($0.0042 = 4200)
    /// @return wei amount to charge for the hire
    function quoteWei(uint256 usdE6) public view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
        require(answer > 0, "feed: bad answer");
        require(block.timestamp - updatedAt <= MAX_STALENESS, "feed: stale");
        // usdE6 * 1e18 / (answer scaled 8dp) → wei
        return (usdE6 * 1e20) / uint256(answer);
    }
}
```

Registry integration is one line at hire time: `uint256 price = oracle.quoteWei(listing.usdQuoteE6); require(msg.value >= price);`. Keep the registry's stored quote in USD (stable meaning across ETH price swings); convert only at the edge.

**Testnet honesty note:** Sepolia feed heartbeats are slower and deviation thresholds wider than mainnet — the staleness constant must be generous, and the UI should show the round's `updatedAt` so nobody mistakes a testnet quote for a tick-fresh price. On mainnet the same contract works unchanged with the mainnet proxy address.

## How the pad UI displays it

Per listing card + hire modal:

- **USD quote** — the human number, big: `$0.0042`
- **Live ETH equivalent** — from the same `quoteWei` via `eth_call` (free): `≈ 0.0000000011 ETH`
- **Oracle provenance line** — small, honest: `ETH/USD $4,318.55 · Chainlink · round 18446744… · updated 3h ago` (links to `data.chain.link` and the Sepolia proxy on Etherscan)

The provenance line is the point: the judge sees a real feed, a real round id, and a timestamp — not a hardcoded price.

## Cheap-to-implement plan (≈2h inside the hackathon window)

1. Add `@chainlink/contracts` dep; drop in `HireQuoteOracle.sol` (~40 lines, above).
2. Unit test against a mock aggregator; fork-test against the real Sepolia proxy.
3. Deploy with the registry (one extra constructor arg); verify on Etherscan.
4. UI: one `eth_call` per listing render + the provenance line.
5. Pulse bonus: emit `QuoteRead(listingId, usdE6, wei, roundId)` at hire → the subgraph (Lane C) indexes it, and the Pulse page shows oracle-verified pricing in the same minute.

## Verdict

**Cheap, real, and thematically perfect** — machine pennies quoted in human dollars, converted by the industry's standard oracle. It stays bench per the prize slate (ENS · Graph · World are submitted), but the code above is the entire implementation cost if depth promotes it.
