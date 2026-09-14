// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {GiftMarket} from "../src/GiftMarket.sol";

/// @title DeployGiftMarket — the open gift market beside an already-live AgentLaunchRegistry.
/// @notice Dual-mode like Deploy.s.sol: same script for Sepolia (11155111) and Base Sepolia (84532).
///         Reads the registry address from $GIFT_REGISTRY, or falls back to the per-chain
///         deployments/<chainId>.json report written by Deploy.s.sol. Appends a "giftMarket"
///         section into a sibling report deployments/<chainId>.giftmarket.json.
///
/// Env:
///   PAD_PRIVATE_KEY  (required) deployer
///   GIFT_REGISTRY    (optional) AgentLaunchRegistry address; default = deployments report
///
/// Sepolia:
///   GIFT_REGISTRY=0x62412fcA6437b914EDD87b85455682Ec73968347 \
///   forge script script/DeployGiftMarket.s.sol --rpc-url $SEPOLIA_RPC --broadcast
contract DeployGiftMarket is Script {
    function run() external {
        uint256 pk = vm.envUint("PAD_PRIVATE_KEY");
        address registry = vm.envOr("GIFT_REGISTRY", address(0));
        if (registry == address(0)) {
            string memory report = vm.readFile(string.concat("deployments/", vm.toString(block.chainid), ".json"));
            registry = vm.parseJsonAddress(report, ".registry");
        }

        vm.startBroadcast(pk);
        GiftMarket market = new GiftMarket(registry);
        vm.stopBroadcast();

        string memory json = "giftmarket";
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeAddress(json, "giftMarket", address(market));
        vm.serializeAddress(json, "registry", registry);
        vm.serializeAddress(json, "deployer", vm.addr(pk));
        vm.serializeUint(json, "blockNumber", block.number);
        string memory out = vm.serializeUint(json, "deployedAt", block.timestamp);
        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".giftmarket.json");
        vm.writeJson(out, path);

        console2.log("giftMarket:", address(market));
        console2.log("registry:", registry);
        console2.log("report:", path);
    }
}
