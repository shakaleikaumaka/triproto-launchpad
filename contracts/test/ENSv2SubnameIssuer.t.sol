// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AgentLaunchRegistry} from "../src/AgentLaunchRegistry.sol";
import {ENSv2SubnameIssuer, IPermissionedResolverText} from "../src/ENSv2SubnameIssuer.sol";
import {IPermissionedRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {RegistryRolesLib} from "@ensdomains/contracts-v2/registry/libraries/RegistryRolesLib.sol";
import {MockENSRegistry, MockENSResolver} from "./mocks/MockENSv2.sol";

/// @notice Dedicated-mode tests: launch wires the ENSv2 PermissionedRegistry + PermissionedResolver
///         legs (via test doubles with the canonical signatures), consent flips sync text records.
contract ENSv2SubnameIssuerTest is Test {
    bytes32 constant PARENT_NODE = bytes32(uint256(0xF00D)); // stands in for namehash("agentohana.eth")

    AgentLaunchRegistry reg;
    ENSv2SubnameIssuer issuer;
    MockENSRegistry ensRegistry;
    MockENSResolver ensResolver;

    address pad = makeAddr("pad");
    address terri = makeAddr("terri");
    address shaka = makeAddr("shaka");
    address rando = makeAddr("rando");

    bytes32 constant MH = keccak256("manifest-bytes");

    event SubnameAssigned(uint256 indexed agentId, string label, bytes32 indexed node, uint256 ensTokenId);
    event SubnameIssued(
        uint256 indexed agentId, string label, bytes32 indexed node, uint256 indexed ensTokenId, address operator
    );

    function setUp() public {
        ensRegistry = new MockENSRegistry();
        ensResolver = new MockENSResolver();
        reg = new AgentLaunchRegistry("My Agent Ohana Registry", "OHANAGENT", pad, "agentohana.eth");
        issuer = new ENSv2SubnameIssuer(
            address(reg), IPermissionedRegistry(address(ensRegistry)), address(ensResolver), PARENT_NODE, "agentohana.eth"
        );
        ensRegistry.setRegistrar(address(issuer)); // stands in for grantRootRoles(ROLE_REGISTRAR, issuer)
        vm.prank(pad);
        reg.setSubnameIssuer(address(issuer));
    }

    function _terriNode() internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(PARENT_NODE, keccak256(bytes("terri"))));
    }

    function _launchTerri() internal returns (uint256) {
        vm.prank(pad);
        return reg.launchAgent(
            terri, "ipfs://bafy/terri.json", MH, "https://terri.example/a2a", "terri", "door@camp", "pit://terri/ops", 7 days
        );
    }

    // ---------------------------------------------------------- dedicated launch
    function test_DedicatedLaunchRegistersSubname() public {
        vm.expectEmit(true, true, true, true, address(issuer));
        emit SubnameIssued(1, "terri", _terriNode(), 1000, terri);
        vm.expectEmit(true, true, true, true, address(reg));
        emit SubnameAssigned(1, "terri", _terriNode(), 1000);
        uint256 id = _launchTerri();
        assertEq(id, 1);

        // the ENSv2 register() leg received exactly the launch parameters
        assertEq(ensRegistry.registerCalls(), 1);
        assertEq(ensRegistry.lastLabel(), "terri");
        assertEq(ensRegistry.lastOwner(), terri); // operator owns the subname token
        assertEq(ensRegistry.lastResolver(), address(ensResolver));
        assertEq(ensRegistry.lastRoleBitmap(), issuer.REGISTRATION_ROLE_BITMAP());
        assertEq(ensRegistry.lastExpiry(), uint64(block.timestamp) + 7 days);

        // registry state anchored
        (,,,,, bytes32 node, uint256 ensTokenId,,,,) = reg.getAgent(1);
        assertEq(node, _terriNode());
        assertEq(ensTokenId, 1000);

        // consent window + agent records written as ENS text records
        bytes32 n = _terriNode();
        assertEq(ensResolver.text(n, "consent.window"), "active");
        assertEq(ensResolver.text(n, "consent.contact"), "door@camp");
        assertEq(ensResolver.text(n, "pit"), "pit://terri/ops");
        assertEq(ensResolver.text(n, "agent.manifest"), "ipfs://bafy/terri.json");
        assertEq(ensResolver.text(n, "agent.service"), "https://terri.example/a2a");
        assertEq(ensResolver.text(n, "agent.id"), "1");
    }

    function test_PermanentCohortGetsMaxExpiry() public {
        vm.prank(pad);
        reg.launchAgent(shaka, "ipfs://bafy/shaka.json", MH, "svc", "shaka", "c", "p", 0);
        assertEq(ensRegistry.lastExpiry(), type(uint64).max);
    }

    function test_RoleBitmapMatchesETHRegistrarCanon() public {
        uint256 expected = RegistryRolesLib.ROLE_SET_SUBREGISTRY | RegistryRolesLib.ROLE_SET_SUBREGISTRY_ADMIN
            | RegistryRolesLib.ROLE_SET_RESOLVER | RegistryRolesLib.ROLE_SET_RESOLVER_ADMIN
            | RegistryRolesLib.ROLE_CAN_TRANSFER_ADMIN;
        assertEq(issuer.REGISTRATION_ROLE_BITMAP(), expected);
    }

    // ---------------------------------------------------------- consent sync
    function test_ConsentFlipSyncsTextRecords() public {
        _launchTerri();

        vm.prank(terri);
        reg.setConsent(1, AgentLaunchRegistry.Consent.Paused, "door2@camp", "pit://terri/v2");
        assertEq(ensResolver.text(_terriNode(), "consent.window"), "paused");
        assertEq(ensResolver.text(_terriNode(), "consent.contact"), "door2@camp");
        assertEq(ensResolver.text(_terriNode(), "pit"), "pit://terri/v2");

        vm.prank(terri);
        reg.setConsent(1, AgentLaunchRegistry.Consent.Withdrawn, "door2@camp", "pit://terri/v2");
        assertEq(ensResolver.text(_terriNode(), "consent.window"), "withdrawn");
    }

    // ---------------------------------------------------------- failure modes
    function test_DuplicateLabelRevertsWholeLaunch() public {
        _launchTerri();
        vm.prank(pad);
        vm.expectRevert(abi.encodeWithSelector(MockENSRegistry.LabelTaken.selector, "terri"));
        reg.launchAgent(
            terri, "ipfs://bafy/terri.json", MH, "https://terri.example/a2a", "terri", "door@camp", "pit://terri/ops", 7 days
        );
        assertEq(reg.totalAgents(), 1); // identity mint rolled back with the subname failure
    }

    function test_OnlyRegistryCanIssue() public {
        vm.prank(rando);
        vm.expectRevert(abi.encodeWithSelector(ENSv2SubnameIssuer.OnlyLaunchRegistry.selector, rando));
        issuer.issue(1, "terri", terri, "m", "s", "c", "p", type(uint64).max);
        vm.prank(rando);
        vm.expectRevert(abi.encodeWithSelector(ENSv2SubnameIssuer.OnlyLaunchRegistry.selector, rando));
        issuer.syncConsent(bytes32(0), "active", "c", "p");
    }

    function test_IssuerWithoutRegistrarRoleReverts() public {
        ensRegistry.setRegistrar(rando); // issuer loses its role
        vm.prank(pad);
        vm.expectRevert(abi.encodeWithSelector(MockENSRegistry.NotRegistrar.selector, address(issuer)));
        reg.launchAgent(terri, "m", MH, "s", "terri", "c", "p", 0);
    }
}
