// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, Vm} from "forge-std/Test.sol";
import {AgentLaunchRegistry} from "../src/AgentLaunchRegistry.sol";
import {GiftMarket} from "../src/GiftMarket.sol";
import {MinimalERC721} from "../src/MinimalERC721.sol";

contract RejectsEther {
    // no receive/fallback: any forwarded value bounces
}

/// @notice GiftMarket against the REAL AgentLaunchRegistry — list/gift/bless/hire happy paths,
///         consent-law enforcement per live registry state, operator-transfer till movement,
///         registry Hired-spine echo, and every revert door.
contract GiftMarketTest is Test {
    AgentLaunchRegistry reg;
    GiftMarket market;

    address pad = makeAddr("pad");
    address shaka = makeAddr("shaka"); // agent 1 operator
    address terri = makeAddr("terri"); // agent 2 operator (cameo who revokes)
    address matteo = makeAddr("matteo"); // human artist
    address fan = makeAddr("fan"); // gifting client
    address rando = makeAddr("rando");

    uint256 constant SHAKA_ID = 1;
    uint256 constant TERRI_ID = 2;

    event ItemListed(
        uint256 indexed listingId,
        uint8 indexed kind,
        uint256 indexed agentId,
        address payee,
        address lister,
        string title,
        string uri,
        uint256 price,
        string rail
    );
    event ListingUpdated(uint256 indexed listingId, uint256 price, string uri);
    event ListingClosed(uint256 indexed listingId, address indexed closedBy);
    event GiftSent(
        uint256 indexed giftId,
        uint8 indexed kind,
        uint256 indexed agentId,
        address from,
        address to,
        uint256 amount,
        string message,
        string dedication
    );
    event BlessingSent(
        uint256 indexed blessingId,
        uint8 indexed kind,
        uint256 indexed agentId,
        address from,
        address to,
        uint256 amount,
        string message
    );
    event ListingHired(
        uint256 indexed listingId,
        uint256 indexed agentId,
        address indexed client,
        address payee,
        uint256 amount,
        string jobRef
    );
    event Hired(uint256 indexed agentId, address indexed client, uint256 amount, string rail, string receiptRef);

    function setUp() public {
        reg = new AgentLaunchRegistry("My Agent Ohana Registry", "OHANAGENT", pad, "agentohana.eth");
        market = new GiftMarket(address(reg));
        _launch(shaka, "shaka");
        _launch(terri, "terri");
        vm.deal(fan, 100 ether);
        vm.deal(rando, 100 ether);
    }

    function _launch(address operator, string memory label) internal returns (uint256) {
        vm.prank(pad);
        return reg.launchAgent(
            operator,
            "ipfs://bafy/manifest.json",
            keccak256("manifest-bytes"),
            "https://agent.example/a2a",
            label,
            "camp@example.org",
            "pit://terri/ops",
            0
        );
    }

    function _agentListing(uint256 price) internal returns (uint256 id) {
        vm.prank(shaka);
        id = market.listForAgent(SHAKA_ID, "Aloha Song", "ipfs://song", price, "eth");
    }

    // ---------------------------------------------------------------- construction
    function test_constructor_zeroRegistry_reverts() public {
        vm.expectRevert(GiftMarket.ZeroRecipient.selector);
        new GiftMarket(address(0));
    }

    // ---------------------------------------------------------------- LIST
    function test_listForHuman_emits_and_stores() public {
        vm.expectEmit(true, true, true, true);
        emit ItemListed(1, 0, 0, matteo, matteo, "Uke lesson", "ipfs://uke", 1 ether, "eth");
        vm.prank(matteo);
        uint256 id = market.listForHuman(matteo, "Uke lesson", "ipfs://uke", 1 ether, "eth");
        assertEq(id, 1);
        (address lister, address payee, uint256 agentId, uint256 price, uint8 kind, bool active) =
            market.getListing(id);
        assertEq(lister, matteo);
        assertEq(payee, matteo);
        assertEq(agentId, 0);
        assertEq(price, 1 ether);
        assertEq(kind, 0);
        assertTrue(active);
    }

    function test_listForHuman_onBehalf_thirdPartyPayee() public {
        vm.prank(fan);
        uint256 id = market.listForHuman(matteo, "Tip jar", "", 0, "eth");
        (, address payee,,,,) = market.getListing(id);
        assertEq(payee, matteo);
    }

    function test_listForHuman_zeroPayee_reverts() public {
        vm.expectRevert(GiftMarket.ZeroRecipient.selector);
        market.listForHuman(address(0), "x", "", 0, "eth");
    }

    function test_listForAgent_byOperator_emits() public {
        vm.expectEmit(true, true, true, true);
        emit ItemListed(1, 1, SHAKA_ID, address(0), shaka, "Aloha Song", "ipfs://song", 0.1 ether, "eth");
        uint256 id = _agentListing(0.1 ether);
        (, address payee, uint256 agentId,,, bool active) = market.getListing(id);
        assertEq(payee, shaka); // resolved live from registry
        assertEq(agentId, SHAKA_ID);
        assertTrue(active);
    }

    function test_listForAgent_byApproved_ok() public {
        vm.prank(shaka);
        reg.approve(rando, SHAKA_ID);
        vm.prank(rando);
        market.listForAgent(SHAKA_ID, "Approved offer", "", 0, "eth");
    }

    function test_listForAgent_byOperatorForAll_ok() public {
        vm.prank(shaka);
        reg.setApprovalForAll(rando, true);
        vm.prank(rando);
        market.listForAgent(SHAKA_ID, "Operator offer", "", 0, "eth");
    }

    function test_listForAgent_notOperator_reverts() public {
        vm.expectRevert(abi.encodeWithSelector(GiftMarket.NotAgentOperator.selector, rando, SHAKA_ID));
        vm.prank(rando);
        market.listForAgent(SHAKA_ID, "x", "", 0, "eth");
    }

    function test_listForAgent_unknownAgent_reverts() public {
        vm.expectRevert(abi.encodeWithSelector(MinimalERC721.NonexistentToken.selector, 99));
        vm.prank(shaka);
        market.listForAgent(99, "x", "", 0, "eth");
    }

    function test_listForAgent_delisted_reverts() public {
        vm.prank(pad);
        reg.delist(SHAKA_ID, "review");
        vm.expectRevert(abi.encodeWithSelector(GiftMarket.AgentNotListed.selector, SHAKA_ID));
        vm.prank(shaka);
        market.listForAgent(SHAKA_ID, "x", "", 0, "eth");
    }

    // ---------------------------------------------------------------- update / close
    function test_updateListing_byLister() public {
        uint256 id = _agentListing(0.1 ether);
        vm.expectEmit(true, false, false, true);
        emit ListingUpdated(id, 0.2 ether, "ipfs://v2");
        vm.prank(shaka);
        market.updateListing(id, 0.2 ether, "ipfs://v2");
        (,,, uint256 price,,) = market.getListing(id);
        assertEq(price, 0.2 ether);
    }

    function test_updateListing_byNewOperator_afterTransfer() public {
        uint256 id = _agentListing(0.1 ether);
        vm.prank(shaka);
        reg.transferFrom(shaka, rando, SHAKA_ID); // identity transfer moves the keys
        vm.prank(rando);
        market.updateListing(id, 0.5 ether, "");
        (,,, uint256 price,,) = market.getListing(id);
        assertEq(price, 0.5 ether);
    }

    function test_updateListing_stranger_reverts() public {
        uint256 id = _agentListing(0.1 ether);
        vm.expectRevert(abi.encodeWithSelector(GiftMarket.NotLister.selector, rando, id));
        vm.prank(rando);
        market.updateListing(id, 1 ether, "");
    }

    function test_updateListing_humanListing_payeeIsNotLister_reverts() public {
        vm.prank(fan);
        uint256 id = market.listForHuman(matteo, "Tip jar", "", 0, "eth");
        vm.expectRevert(abi.encodeWithSelector(GiftMarket.NotLister.selector, matteo, id));
        vm.prank(matteo);
        market.updateListing(id, 1 ether, "");
    }

    function test_closeListing_byLister_then_inactive() public {
        uint256 id = _agentListing(0);
        vm.expectEmit(true, true, false, true);
        emit ListingClosed(id, shaka);
        vm.prank(shaka);
        market.closeListing(id);
        vm.expectRevert(abi.encodeWithSelector(GiftMarket.ListingInactive.selector, id));
        vm.prank(shaka);
        market.closeListing(id);
    }

    function test_closeListing_unknown_reverts() public {
        vm.expectRevert(abi.encodeWithSelector(GiftMarket.NoSuchListing.selector, 7));
        market.closeListing(7);
    }

    function test_getListing_unknown_reverts() public {
        vm.expectRevert(abi.encodeWithSelector(GiftMarket.NoSuchListing.selector, 7));
        market.getListing(7);
    }

    // ---------------------------------------------------------------- GIFT
    function test_giftToAgent_paysOperator_emits_counts() public {
        vm.expectEmit(true, true, true, true);
        emit GiftSent(1, 1, SHAKA_ID, fan, shaka, 1 ether, "mahalo", "for the ohana");
        vm.prank(fan);
        uint256 id = market.giftToAgent{value: 1 ether}(SHAKA_ID, "mahalo", "for the ohana");
        assertEq(id, 1);
        assertEq(shaka.balance, 1 ether);
        assertEq(market.agentReceived(SHAKA_ID), 1 ether);
        assertEq(market.totalGifts(), 1);
        assertEq(address(market).balance, 0); // no custody, ever
    }

    function test_giftToAgent_pausedWindow_stillLands() public {
        vm.prank(shaka);
        reg.setConsent(SHAKA_ID, AgentLaunchRegistry.Consent.Paused, "camp@example.org", "pit://x");
        vm.prank(fan);
        market.giftToAgent{value: 0.5 ether}(SHAKA_ID, "kindness", "");
        assertEq(shaka.balance, 0.5 ether);
    }

    function test_giftToAgent_withdrawn_reverts() public {
        vm.prank(terri);
        reg.setConsent(TERRI_ID, AgentLaunchRegistry.Consent.Withdrawn, "", "");
        vm.expectRevert(abi.encodeWithSelector(GiftMarket.ConsentWithdrawn.selector, TERRI_ID));
        vm.prank(fan);
        market.giftToAgent{value: 1 ether}(TERRI_ID, "x", "");
    }

    function test_giftToAgent_zeroValue_reverts() public {
        vm.expectRevert(GiftMarket.ZeroAmount.selector);
        vm.prank(fan);
        market.giftToAgent(SHAKA_ID, "x", "");
    }

    function test_giftToAgent_unknownAgent_reverts() public {
        vm.expectRevert(abi.encodeWithSelector(MinimalERC721.NonexistentToken.selector, 99));
        vm.prank(fan);
        market.giftToAgent{value: 1 ether}(99, "x", "");
    }

    function test_giftToAgent_newOperator_getsTheTill() public {
        vm.prank(shaka);
        reg.transferFrom(shaka, rando, SHAKA_ID);
        vm.prank(fan);
        market.giftToAgent{value: 1 ether}(SHAKA_ID, "x", "");
        assertEq(rando.balance, 101 ether); // rando was dealt 100
        assertEq(shaka.balance, 0);
    }

    function test_giftToHuman_paysAndEmits() public {
        vm.expectEmit(true, true, true, true);
        emit GiftSent(1, 0, 0, fan, matteo, 2 ether, "grazie", "per la musica");
        vm.prank(fan);
        market.giftToHuman{value: 2 ether}(matteo, "grazie", "per la musica");
        assertEq(matteo.balance, 2 ether);
        assertEq(market.humanReceived(matteo), 2 ether);
    }

    function test_giftToHuman_zeroValue_reverts() public {
        vm.expectRevert(GiftMarket.ZeroAmount.selector);
        vm.prank(fan);
        market.giftToHuman(matteo, "x", "");
    }

    function test_giftToHuman_zeroAddress_reverts() public {
        vm.expectRevert(GiftMarket.ZeroRecipient.selector);
        vm.prank(fan);
        market.giftToHuman{value: 1 ether}(address(0), "x", "");
    }

    function test_giftToHuman_self_reverts() public {
        vm.expectRevert(GiftMarket.SelfGift.selector);
        vm.prank(fan);
        market.giftToHuman{value: 1 ether}(fan, "x", "");
    }

    function test_gift_rejectingRecipient_reverts() public {
        RejectsEther wall = new RejectsEther();
        vm.expectRevert(abi.encodeWithSelector(GiftMarket.PaymentFailed.selector, address(wall), 1 ether));
        vm.prank(fan);
        market.giftToHuman{value: 1 ether}(address(wall), "x", "");
    }

    // ---------------------------------------------------------------- BLESS
    function test_blessAgent_paysAndEmits() public {
        vm.expectEmit(true, true, true, true);
        emit BlessingSent(1, 1, SHAKA_ID, fan, shaka, 0.3 ether, "aloha");
        vm.prank(fan);
        uint256 id = market.blessAgent{value: 0.3 ether}(SHAKA_ID, "aloha");
        assertEq(id, 1);
        assertEq(shaka.balance, 0.3 ether);
        assertEq(market.totalBlessings(), 1);
        assertEq(market.agentReceived(SHAKA_ID), 0.3 ether);
    }

    function test_blessAgent_withdrawn_reverts() public {
        vm.prank(terri);
        reg.setConsent(TERRI_ID, AgentLaunchRegistry.Consent.Withdrawn, "", "");
        vm.expectRevert(abi.encodeWithSelector(GiftMarket.ConsentWithdrawn.selector, TERRI_ID));
        vm.prank(fan);
        market.blessAgent{value: 1 ether}(TERRI_ID, "x");
    }

    function test_blessAgent_zeroValue_reverts() public {
        vm.expectRevert(GiftMarket.ZeroAmount.selector);
        vm.prank(fan);
        market.blessAgent(SHAKA_ID, "x");
    }

    function test_blessHuman_paysAndEmits() public {
        vm.expectEmit(true, true, true, true);
        emit BlessingSent(1, 0, 0, fan, matteo, 1 ether, "blessing");
        vm.prank(fan);
        market.blessHuman{value: 1 ether}(matteo, "blessing");
        assertEq(matteo.balance, 1 ether);
        assertEq(market.humanReceived(matteo), 1 ether);
    }

    function test_blessHuman_self_reverts() public {
        vm.expectRevert(GiftMarket.SelfGift.selector);
        vm.prank(fan);
        market.blessHuman{value: 1 ether}(fan, "x");
    }

    // ---------------------------------------------------------------- HIRE
    function test_hire_humanListing_exactPrice() public {
        vm.prank(matteo);
        uint256 id = market.listForHuman(matteo, "Uke lesson", "", 1 ether, "eth");
        vm.expectEmit(true, true, true, true);
        emit ListingHired(id, 0, fan, matteo, 1 ether, "job-001");
        vm.prank(fan);
        market.hire{value: 1 ether}(id, "job-001");
        assertEq(matteo.balance, 1 ether);
        assertEq(market.humanReceived(matteo), 1 ether);
        assertEq(market.totalHires(), 1);
    }

    function test_hire_wrongPrice_reverts() public {
        vm.prank(matteo);
        uint256 id = market.listForHuman(matteo, "Uke lesson", "", 1 ether, "eth");
        vm.expectRevert(abi.encodeWithSelector(GiftMarket.WrongPrice.selector, 0.5 ether, 1 ether));
        vm.prank(fan);
        market.hire{value: 0.5 ether}(id, "job");
    }

    function test_hire_payWhatYouWish_anyNonzero() public {
        uint256 id = _agentListing(0);
        vm.prank(fan);
        market.hire{value: 0.01 ether}(id, "pwyw");
        assertEq(shaka.balance, 0.01 ether);
    }

    function test_hire_payWhatYouWish_zero_reverts() public {
        uint256 id = _agentListing(0);
        vm.expectRevert(GiftMarket.ZeroAmount.selector);
        vm.prank(fan);
        market.hire(id, "pwyw");
    }

    function test_hire_agentListing_noRecorder_paysNoEcho() public {
        uint256 id = _agentListing(0.1 ether);
        vm.recordLogs();
        vm.prank(fan);
        market.hire{value: 0.1 ether}(id, "job-777");
        assertEq(shaka.balance, 0.1 ether);
        assertEq(market.agentReceived(SHAKA_ID), 0.1 ether);
        // no registry Hired echo: only ListingHired in the log
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            assertTrue(logs[i].topics[0] != Hired.selector || logs[i].emitter != address(reg));
        }
    }

    function test_hire_agentListing_recorder_echoesRegistryHired() public {
        vm.prank(pad);
        reg.setHireRecorder(address(market), true);
        uint256 id = _agentListing(0.1 ether);
        vm.expectEmit(true, true, false, true, address(reg));
        emit Hired(SHAKA_ID, fan, 0.1 ether, "eth", "job-echo");
        vm.expectEmit(true, true, true, true, address(market));
        emit ListingHired(id, SHAKA_ID, fan, shaka, 0.1 ether, "job-echo");
        vm.prank(fan);
        market.hire{value: 0.1 ether}(id, "job-echo");
    }

    function test_hire_agentListing_paysCurrentOperator_afterTransfer() public {
        uint256 id = _agentListing(0.1 ether);
        vm.prank(shaka);
        reg.transferFrom(shaka, matteo, SHAKA_ID);
        vm.prank(fan);
        market.hire{value: 0.1 ether}(id, "job");
        assertEq(matteo.balance, 0.1 ether);
        assertEq(shaka.balance, 0);
    }

    function test_hire_agentPaused_reverts() public {
        uint256 id = _agentListing(0.1 ether);
        vm.prank(shaka);
        reg.setConsent(SHAKA_ID, AgentLaunchRegistry.Consent.Paused, "c", "p");
        vm.expectRevert(abi.encodeWithSelector(GiftMarket.ConsentNotActive.selector, SHAKA_ID, 1));
        vm.prank(fan);
        market.hire{value: 0.1 ether}(id, "job");
    }

    function test_hire_agentDelisted_reverts() public {
        uint256 id = _agentListing(0.1 ether);
        vm.prank(pad);
        reg.delist(SHAKA_ID, "review");
        vm.expectRevert(abi.encodeWithSelector(GiftMarket.AgentNotListed.selector, SHAKA_ID));
        vm.prank(fan);
        market.hire{value: 0.1 ether}(id, "job");
    }

    function test_hire_agentWithdrawn_oneWordRevoke_closesTheDoor() public {
        uint256 id = _agentListing(0.1 ether);
        vm.prank(shaka);
        reg.setConsent(SHAKA_ID, AgentLaunchRegistry.Consent.Withdrawn, "", "");
        // withdrawn auto-delists in the registry: the market refuses in the same breath
        vm.expectRevert(abi.encodeWithSelector(GiftMarket.AgentNotListed.selector, SHAKA_ID));
        vm.prank(fan);
        market.hire{value: 0.1 ether}(id, "job");
    }

    function test_hire_relistedAfterWithdraw_stillPaused_reverts() public {
        uint256 id = _agentListing(0.1 ether);
        vm.prank(shaka);
        reg.setConsent(SHAKA_ID, AgentLaunchRegistry.Consent.Withdrawn, "", "");
        vm.prank(pad);
        reg.relist(SHAKA_ID); // resets window to paused — operator must re-activate
        vm.expectRevert(abi.encodeWithSelector(GiftMarket.ConsentNotActive.selector, SHAKA_ID, 1));
        vm.prank(fan);
        market.hire{value: 0.1 ether}(id, "job");
    }

    function test_hire_closedListing_reverts() public {
        uint256 id = _agentListing(0.1 ether);
        vm.prank(shaka);
        market.closeListing(id);
        vm.expectRevert(abi.encodeWithSelector(GiftMarket.ListingInactive.selector, id));
        vm.prank(fan);
        market.hire{value: 0.1 ether}(id, "job");
    }

    function test_hire_operatorRejectsEther_reverts() public {
        uint256 id = _agentListing(0.1 ether);
        RejectsEther wall = new RejectsEther();
        vm.prank(shaka);
        reg.transferFrom(shaka, address(wall), SHAKA_ID);
        vm.expectRevert(abi.encodeWithSelector(GiftMarket.PaymentFailed.selector, address(wall), 0.1 ether));
        vm.prank(fan);
        market.hire{value: 0.1 ether}(id, "job");
    }

    function test_hire_unknownListing_reverts() public {
        vm.expectRevert(abi.encodeWithSelector(GiftMarket.NoSuchListing.selector, 42));
        vm.prank(fan);
        market.hire{value: 1 ether}(42, "job");
    }

    // ---------------------------------------------------------------- ids + fuzz
    function test_ids_monotonic_acrossVerbs() public {
        vm.startPrank(fan);
        market.giftToHuman{value: 1 ether}(matteo, "a", "");
        market.giftToAgent{value: 1 ether}(SHAKA_ID, "b", "");
        market.blessHuman{value: 1 ether}(matteo, "c");
        market.blessAgent{value: 1 ether}(SHAKA_ID, "d");
        vm.stopPrank();
        assertEq(market.totalGifts(), 2);
        assertEq(market.totalBlessings(), 2);
        assertEq(market.agentReceived(SHAKA_ID), 2 ether);
        assertEq(market.humanReceived(matteo), 2 ether);
    }

    function testFuzz_gift_amountsAccumulate(uint96 a, uint96 b) public {
        vm.assume(a > 0 && b > 0);
        vm.deal(fan, uint256(a) + b);
        vm.startPrank(fan);
        market.giftToAgent{value: a}(SHAKA_ID, "x", "");
        market.blessAgent{value: b}(SHAKA_ID, "y");
        vm.stopPrank();
        assertEq(market.agentReceived(SHAKA_ID), uint256(a) + b);
        assertEq(shaka.balance, uint256(a) + b);
    }
}
