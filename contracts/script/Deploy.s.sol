// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {AgentLaunchRegistry} from "../src/AgentLaunchRegistry.sol";
import {ENSv2SubnameIssuer} from "../src/ENSv2SubnameIssuer.sol";
import {IPermissionedRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";

/// @title Deploy — the launch spine to any EVM chain (Sepolia 11155111 · Base Sepolia 84532).
/// @notice DEDICATED mode when the full ENSv2 env set is present, FALLBACK (label-only) otherwise;
///         the chosen mode is recorded in the deterministic per-chain report deployments/<chainId>.json.
///
/// Env:
///   PAD_PRIVATE_KEY          (required) deployer + pad wallet
///   REGISTRY_NAME            (optional) default "My Agent Ohana Registry"
///   REGISTRY_SYMBOL          (optional) default "OHANAGENT"
///   FAMILY_NAME              (optional) default "agentohana.eth"
///   ENSV2_SUBNAME_REGISTRY   (optional) UserRegistry proxy of the family name (Verifiable Factory)
///   ENSV2_PAD_RESOLVER       (optional) pad's PermissionedResolver proxy
///   ENSV2_PARENT_NODE        (optional) namehash(FAMILY_NAME), uint256
///
/// Sepolia:
///   forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC --broadcast --verify
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PAD_PRIVATE_KEY");
        address pad = vm.addr(pk);
        string memory name_ = vm.envOr("REGISTRY_NAME", string("My Agent Ohana Registry"));
        string memory symbol_ = vm.envOr("REGISTRY_SYMBOL", string("OHANAGENT"));
        string memory family = vm.envOr("FAMILY_NAME", string("agentohana.eth"));
        address subnameRegistry = vm.envOr("ENSV2_SUBNAME_REGISTRY", address(0));
        address resolver = vm.envOr("ENSV2_PAD_RESOLVER", address(0));
        bytes32 parentNode = vm.envOr("ENSV2_PARENT_NODE", bytes32(0));

        bool dedicated = subnameRegistry != address(0) && resolver != address(0) && parentNode != bytes32(0);

        vm.startBroadcast(pk);
        AgentLaunchRegistry registry = new AgentLaunchRegistry(name_, symbol_, pad, family);
        ENSv2SubnameIssuer issuer;
        if (dedicated) {
            issuer = new ENSv2SubnameIssuer(
                address(registry), IPermissionedRegistry(subnameRegistry), resolver, parentNode, family
            );
            registry.setSubnameIssuer(address(issuer));
        }
        vm.stopBroadcast();

        string memory mode = dedicated ? "dedicated-ensv2" : "fallback-label-only";

        // deterministic report: stable schema, stable key order, one file per chainId
        string memory json = "deploy";
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeString(json, "mode", mode);
        vm.serializeAddress(json, "registry", address(registry));
        vm.serializeAddress(json, "issuer", address(issuer));
        vm.serializeAddress(json, "pad", pad);
        vm.serializeString(json, "familyName", family);
        vm.serializeBytes32(json, "parentNode", parentNode);
        vm.serializeAddress(json, "subnameRegistry", subnameRegistry);
        vm.serializeAddress(json, "resolver", resolver);
        vm.serializeUint(json, "blockNumber", block.number);
        string memory out = vm.serializeUint(json, "deployedAt", block.timestamp);

        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(out, path);

        console2.log("mode:", mode);
        console2.log("registry:", address(registry));
        console2.log("issuer:", address(issuer));
        console2.log("report:", path);
    }
}
