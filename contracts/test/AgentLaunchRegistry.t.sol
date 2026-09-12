// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AgentLaunchRegistry} from "../src/AgentLaunchRegistry.sol";

/// @notice Core lifecycle tests — FALLBACK mode (no issuer wired): cohort flow of the white paper
///         (3 permanent agents SHAKA/PIT/OHANA + 1 cameo TERRI who revokes), consent flips,
///         moderation, metadata alignment, operator transfer, hire/bless lanes.
contract AgentLaunchRegistryTest is Test {
    AgentLaunchRegistry reg;

    address pad = makeAddr("pad");
    address shaka = makeAddr("shaka");
    address pit = makeAddr("pit");
    address ohana = makeAddr("ohana");
    address terri = makeAddr("terri");
    address rando = makeAddr("rando");

    bytes32 constant MH = keccak256("manifest-bytes");

    event AgentLaunched(
        uint256 indexed agentId,
        address indexed operator,
        bytes32 indexed manifestHash,
        string manifestURI,
        string serviceEndpoint,
        string label,
        uint64 expiry
    );
    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event ConsentChanged(
        uint256 indexed agentId, uint8 indexed status, address indexed changedBy, string consentContact, string pitPointer
    );
    event Delisted(uint256 indexed agentId, address indexed delistedBy, string reason);
    event Relisted(uint256 indexed agentId, address indexed relistedBy);
    event SubnameAssigned(uint256 indexed agentId, string label, bytes32 indexed node, uint256 ensTokenId);
    event Hired(uint256 indexed agentId, address indexed client, uint256 amount, string rail, string receiptRef);
    event Blessed(uint256 indexed agentId, address indexed operator, string verifier, string proofRef);

    function setUp() public {
        reg = new AgentLaunchRegistry("My Agent Ohana Registry", "OHANAGENT", pad, "agentohana.eth");
    }

    function _launch(address operator, string memory label, uint64 duration) internal returns (uint256) {
        vm.prank(pad);
        return reg.launchAgent(
            operator,
            "ipfs://bafy/manifest.json",
            MH,
            "https://agent.example/a2a",
            label,
            "camp@example.org",
            "pit://terri/ops",
            duration
        );
    }

    function _cohort() internal {
        _launch(shaka, "shaka", 0);
        _launch(pit, "pit", 0);
        _launch(ohana, "ohana", 0);
        _launch(terri, "terri", 7 days);
    }

    // ---------------------------------------------------------- launch + cohort
    function test_LaunchCohort_FallbackMode() public {
        _cohort();
        assertEq(reg.totalAgents(), 4);
        assertEq(reg.ownerOf(1), shaka);
        assertEq(reg.ownerOf(4), terri);

        (address op, string memory uri, bytes32 hash, string memory svc, string memory label,,, uint8 consent, bool listed,, uint64 expiry) =
            reg.getAgent(4);
        assertEq(op, terri);
        assertEq(uri, "ipfs://bafy/manifest.json");
        assertEq(hash, MH);
        assertEq(svc, "https://agent.example/a2a");
        assertEq(label, "terri");
        assertEq(consent, uint8(AgentLaunchRegistry.Consent.Active));
        assertTrue(listed);
        assertEq(expiry, uint64(block.timestamp) + 7 days); // cameo: 7-day subname

        (,,,,,,,,,, uint64 shakaExpiry) = reg.getAgent(1);
        assertEq(shakaExpiry, type(uint64).max); // permanent cohort

        assertEq(string(reg.getMetadata(1, "consent.window")), "active");
        assertEq(string(reg.getMetadata(1, "consent.contact")), "camp@example.org");
        assertEq(string(reg.getMetadata(1, "pit")), "pit://terri/ops");
        assertEq(reg.getMetadata(1, "manifestHash"), bytes.concat(MH));
        assertTrue(reg.verifyManifest(1, bytes("manifest-bytes")));
    }

    function test_LaunchEmitsSpineEvents() public {
        vm.expectEmit(true, true, true, true);
        emit AgentLaunched(
            1, shaka, MH, "ipfs://bafy/manifest.json", "https://agent.example/a2a", "shaka", type(uint64).max
        );
        _launch(shaka, "shaka", 0);
        // fallback mode: no issuer => no SubnameAssigned, node stays 0
        (,,,,, bytes32 node, uint256 ensTokenId,,,,) = reg.getAgent(1);
        assertEq(node, bytes32(0));
        assertEq(ensTokenId, 0);
    }

    // ---------------------------------------------------------- consent window
    function test_ConsentFlipFlow_CameoRevokes() public {
        _cohort();

        vm.prank(terri);
        vm.expectEmit(true, true, true, true);
        emit ConsentChanged(4, uint8(AgentLaunchRegistry.Consent.Paused), terri, "door@camp", "pit://terri/v2");
        reg.setConsent(4, AgentLaunchRegistry.Consent.Paused, "door@camp", "pit://terri/v2");
        assertEq(string(reg.getMetadata(4, "consent.window")), "paused");

        vm.prank(terri);
        reg.setConsent(4, AgentLaunchRegistry.Consent.Active, "door@camp", "pit://terri/v2");

        // the one-word revoke: ConsentChanged(withdrawn) + Delisted land in the SAME tx
        vm.prank(terri);
        vm.expectEmit(true, true, true, true);
        emit ConsentChanged(4, uint8(AgentLaunchRegistry.Consent.Withdrawn), terri, "door@camp", "pit://terri/v2");
        vm.expectEmit(true, true, true, true);
        emit Delisted(4, terri, "consent withdrawn");
        reg.setConsent(4, AgentLaunchRegistry.Consent.Withdrawn, "door@camp", "pit://terri/v2");

        (,,,,,,, uint8 consent, bool listed,,) = reg.getAgent(4);
        assertEq(consent, uint8(AgentLaunchRegistry.Consent.Withdrawn));
        assertFalse(listed);
        assertEq(string(reg.getMetadata(4, "consent.window")), "withdrawn");

        // locked after the door closes
        vm.prank(terri);
        vm.expectRevert(abi.encodeWithSelector(AgentLaunchRegistry.NotListed.selector, 4));
        reg.setConsent(4, AgentLaunchRegistry.Consent.Active, "x", "y");

        // the permanent cohort is untouched
        (,,,,,,,, bool shakaListed,,) = reg.getAgent(1);
        assertTrue(shakaListed);
    }

    function test_OnlyOperatorCanFlipConsent() public {
        _cohort();
        vm.prank(rando);
        vm.expectRevert(abi.encodeWithSelector(AgentLaunchRegistry.NotOperator.selector, rando, 1));
        reg.setConsent(1, AgentLaunchRegistry.Consent.Paused, "x", "y");

        // even the pad cannot speak for the operator's window
        vm.prank(pad);
        vm.expectRevert(abi.encodeWithSelector(AgentLaunchRegistry.NotOperator.selector, pad, 1));
        reg.setConsent(1, AgentLaunchRegistry.Consent.Paused, "x", "y");

        // ERC-721-approved deputy CAN flip (operator delegation)
        vm.prank(shaka);
        reg.approve(rando, 1);
        vm.prank(rando);
        reg.setConsent(1, AgentLaunchRegistry.Consent.Paused, "dep@camp", "pit://shaka");
        assertEq(string(reg.getMetadata(1, "consent.window")), "paused");
    }

    // ---------------------------------------------------------- moderation
    function test_PadModerationDelistAndRelist() public {
        _cohort();
        vm.prank(pad);
        vm.expectEmit(true, true, true, true);
        emit Delisted(2, pad, "moderation review");
        reg.delist(2, "moderation review");

        vm.prank(pad);
        vm.expectRevert(abi.encodeWithSelector(AgentLaunchRegistry.AlreadyDelisted.selector, 2));
        reg.delist(2, "again");

        vm.prank(pad);
        vm.expectEmit(true, true, true, true);
        emit Relisted(2, pad);
        reg.relist(2);

        // consent preserved (was Active, pad delist never touches the window)
        (,,,,,,, uint8 consent, bool listed,,) = reg.getAgent(2);
        assertEq(consent, uint8(AgentLaunchRegistry.Consent.Active));
        assertTrue(listed);
    }

    function test_OperatorDelistsSelf() public {
        _cohort();
        vm.prank(ohana);
        vm.expectEmit(true, true, true, true);
        emit Delisted(3, ohana, "leaving the pad");
        reg.delist(3, "leaving the pad");
    }

    function test_RelistResetsWithdrawnToPaused() public {
        _cohort();
        vm.prank(terri);
        reg.setConsent(4, AgentLaunchRegistry.Consent.Withdrawn, "door@camp", "pit://terri/v2");

        vm.prank(pad);
        vm.expectEmit(true, true, true, true);
        emit ConsentChanged(4, uint8(AgentLaunchRegistry.Consent.Paused), pad, "door@camp", "pit://terri/v2");
        reg.relist(4);

        // operator may now re-activate
        vm.prank(terri);
        reg.setConsent(4, AgentLaunchRegistry.Consent.Active, "door@camp", "pit://terri/v2");
        assertEq(string(reg.getMetadata(4, "consent.window")), "active");
    }

    // ---------------------------------------------------------- fallback anchoring
    function test_AnchorSubname_FallbackPath() public {
        _cohort();
        bytes32 node = keccak256("namehash(terri.agentohana.eth)");
        vm.prank(rando);
        vm.expectRevert(AgentLaunchRegistry.NotPad.selector);
        reg.anchorSubname(4, node, 4242);

        vm.prank(pad);
        vm.expectEmit(true, true, true, true);
        emit SubnameAssigned(4, "terri", node, 4242);
        reg.anchorSubname(4, node, 4242);

        (,,,,, bytes32 gotNode, uint256 gotToken,,,,) = reg.getAgent(4);
        assertEq(gotNode, node);
        assertEq(gotToken, 4242);

        vm.prank(pad);
        vm.expectRevert(abi.encodeWithSelector(AgentLaunchRegistry.SubnameAlreadyAnchored.selector, 4));
        reg.anchorSubname(4, node, 9999);
    }

    // ---------------------------------------------------------- ERC-8004 alignment
    function test_ERC8004_BareRegisterAndMetadata() public {
        vm.prank(rando);
        vm.expectEmit(true, true, true, true);
        emit Registered(1, "ipfs://bafy/solo.json", rando);
        uint256 id = reg.register("ipfs://bafy/solo.json");
        assertEq(id, 1);
        assertEq(reg.tokenURI(1), "ipfs://bafy/solo.json");
        assertEq(string(reg.getMetadata(1, "manifestURI")), "ipfs://bafy/solo.json");
        (,,,,,,, uint8 consent, bool listed,,) = reg.getAgent(1);
        assertEq(consent, uint8(AgentLaunchRegistry.Consent.Paused));
        assertFalse(listed); // identity only — not a marketplace listing

        // operator sets free-form metadata
        vm.prank(rando);
        reg.setMetadata(1, "skills", bytes("['camp-ops','aloha']"));
        assertEq(reg.getMetadata(1, "skills"), bytes("['camp-ops','aloha']"));

        // reserved + canonical keys are protected
        vm.prank(rando);
        vm.expectRevert(abi.encodeWithSelector(AgentLaunchRegistry.ReservedKey.selector, "agentWallet"));
        reg.setMetadata(1, "agentWallet", bytes("0x00"));
        vm.prank(rando);
        vm.expectRevert(abi.encodeWithSelector(AgentLaunchRegistry.CanonicalKey.selector, "consent.window"));
        reg.setMetadata(1, "consent.window", bytes("active"));

        // manifest rebind
        vm.prank(rando);
        reg.setAgentURI(1, "ipfs://bafy/solo-v2.json");
        vm.prank(rando);
        reg.updateManifestHash(1, keccak256("v2"));
        assertEq(reg.tokenURI(1), "ipfs://bafy/solo-v2.json");
        assertEq(reg.getMetadata(1, "manifestHash"), bytes.concat(keccak256("v2")));
    }

    // ---------------------------------------------------------- operator transfer
    function test_TransferMovesOperator() public {
        _cohort();
        address newOp = makeAddr("newOp");
        vm.prank(shaka);
        reg.transferFrom(shaka, newOp, 1);

        vm.prank(shaka); // old operator lost the keys
        vm.expectRevert(abi.encodeWithSelector(AgentLaunchRegistry.NotOperator.selector, shaka, 1));
        reg.setConsent(1, AgentLaunchRegistry.Consent.Paused, "x", "y");

        vm.prank(newOp); // new operator holds them
        reg.setConsent(1, AgentLaunchRegistry.Consent.Paused, "new@camp", "pit://shaka");
        assertEq(string(reg.getMetadata(1, "consent.window")), "paused");
    }

    // ---------------------------------------------------------- hire + bless lanes
    function test_HireAndBlessLanes() public {
        _cohort();
        address rail = makeAddr("x402rail");
        address worldLane = makeAddr("worldLane");

        vm.prank(rando);
        vm.expectRevert(abi.encodeWithSelector(AgentLaunchRegistry.NotRecorder.selector, rando));
        reg.recordHire(4, rando, 4200, "x402/base", "receipt:0xabc");
        vm.prank(rando);
        vm.expectRevert(abi.encodeWithSelector(AgentLaunchRegistry.NotBlesser.selector, rando));
        reg.bless(1, "world-selfie", "proof:0xdef");

        vm.startPrank(pad);
        reg.setHireRecorder(rail, true);
        reg.setBlesser(worldLane, true);
        vm.stopPrank();

        vm.prank(rail);
        vm.expectEmit(true, true, true, true);
        emit Hired(4, rando, 4200, "x402/base", "receipt:0xabc"); // $0.0042 machine pennies
        reg.recordHire(4, rando, 4200, "x402/base", "receipt:0xabc");

        vm.prank(worldLane);
        vm.expectEmit(true, true, true, true);
        emit Blessed(1, shaka, "world-selfie", "proof:0xdef");
        reg.bless(1, "world-selfie", "proof:0xdef");
    }

    // ---------------------------------------------------------- validation
    function test_LaunchValidation() public {
        vm.prank(pad);
        vm.expectRevert(AgentLaunchRegistry.EmptyManifest.selector);
        reg.launchAgent(shaka, "", MH, "svc", "shaka", "c", "p", 0);
        vm.prank(pad);
        vm.expectRevert(AgentLaunchRegistry.EmptyLabel.selector);
        reg.launchAgent(shaka, "ipfs://x", MH, "svc", "", "c", "p", 0);
        vm.prank(pad);
        vm.expectRevert(AgentLaunchRegistry.ZeroOperator.selector);
        reg.launchAgent(address(0), "ipfs://x", MH, "svc", "shaka", "c", "p", 0);
        vm.prank(rando); // neither pad nor the operator
        vm.expectRevert(AgentLaunchRegistry.NotPadOrOperator.selector);
        reg.launchAgent(shaka, "ipfs://x", MH, "svc", "shaka", "c", "p", 0);

        vm.prank(shaka); // self-launch is a first-class path
        uint256 id = reg.launchAgent(shaka, "ipfs://x", MH, "svc", "shaka", "c", "p", 0);
        assertEq(reg.ownerOf(id), shaka);
    }

    function test_GetMetadata_UnknownKeyEmpty() public {
        _cohort();
        assertEq(reg.getMetadata(1, "nonexistent"), bytes(""));
    }
}
