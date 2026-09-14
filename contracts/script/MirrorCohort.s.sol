// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {AgentLaunchRegistry} from "../src/AgentLaunchRegistry.sol";

/// @title MirrorCohort — replay the founding Sepolia cohort onto a fresh registry leg.
/// @notice Mirrors the four founding launches exactly as they live on Sepolia
///         (registry 0x62412fcA6437b914EDD87b85455682Ec73968347, agents 1-4):
///         SHAKA=1 · PIT=2 · OHANA=3 · TERRI=4 (operator = Shaka's wallet).
///
/// Env:
///   PAD_PRIVATE_KEY  (required) the pad — must match the registry's pad
///   COHORT_REGISTRY  (optional) target registry; default = deployments/<chainId>.json
contract MirrorCohort is Script {
    uint64 constant DURATION = 1_096_000_000; // same ~34.7y window as the Sepolia originals
    address constant TERRI_OPERATOR = 0x1216C288be58c47a65f8Ea008b404d098D177A1C;

    function run() external {
        uint256 pk = vm.envUint("PAD_PRIVATE_KEY");
        address pad = vm.addr(pk);
        address regAddr = vm.envOr("COHORT_REGISTRY", address(0));
        if (regAddr == address(0)) {
            string memory report = vm.readFile(string.concat("deployments/", vm.toString(block.chainid), ".json"));
            regAddr = vm.parseJsonAddress(report, ".registry");
        }
        AgentLaunchRegistry reg = AgentLaunchRegistry(regAddr);

        vm.startBroadcast(pk);
        _launch(reg, pad, "shaka", "ipfs://ohana-shaka-manifest", 0x047e2564e88e24b7ed217927d6278511b6c8adb366afbd85ab5781ad7c99277c, "https://agentohana.org/shaka", "pit://publicinform/shaka");
        _launch(reg, pad, "pit", "ipfs://ohana-pit-manifest", 0xd34713348233cb7baaf727b1f824a5069e31efd9d204f559b2e58a9495154569, "https://publicinform.com/pit", "pit://publicinform/pit");
        _launch(reg, pad, "ohana", "ipfs://ohana-ohana-manifest", 0xab68fddc3eb90d3bef6adaa1f61cf3ae372536a76c1d9a2fe0359cd7c89ff391, "https://agentohana.org/ohana", "pit://publicinform/ohana");
        _launch(reg, TERRI_OPERATOR, "terri", "ipfs://ohana-terri-manifest", 0xf03ac5dcdaf0d862a9a2631e57884c93b67c0ae785f155a532b9bd817e947de8, "https://theshellpit.com/terri", "pit://publicinform/terri");
        vm.stopBroadcast();

        console2.log("cohort mirrored onto", regAddr, "totalAgents:", reg.totalAgents());
    }

    function _launch(
        AgentLaunchRegistry reg,
        address operator,
        string memory label,
        string memory manifestURI,
        bytes32 manifestHash,
        string memory serviceEndpoint,
        string memory pitPointer
    ) internal {
        reg.launchAgent(
            operator, manifestURI, manifestHash, serviceEndpoint, label, "aloha@myagentohana.com", pitPointer, DURATION
        );
    }
}
