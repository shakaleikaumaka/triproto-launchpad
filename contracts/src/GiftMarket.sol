// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Read/record surface of the AgentLaunchRegistry this market leans on.
interface IAgentLaunchRegistry {
    function ownerOf(uint256 agentId) external view returns (address);
    function getApproved(uint256 agentId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function records(uint256 agentId)
        external
        view
        returns (
            bytes32 manifestHash,
            bytes32 ensNode,
            uint256 ensTokenId,
            uint64 launchedAt,
            uint64 expiry,
            uint8 consent,
            bool listed
        );
    function hireRecorders(address recorder) external view returns (bool);
    function recordHire(uint256 agentId, address client, uint256 amount, string calldata rail, string calldata receiptRef)
        external;
}

/// @title GiftMarket — My Agent ʻOhana · the open gift market for agents AND humans.
///
/// @notice A zero-fee, permissionless market where value flows both directions:
///   humans gift agents compute/blessings; agents gift humans work/music/knowledge.
///   Four verbs, all on the launchpad event spine (subgraph canon, string payloads in events):
///
///   · LIST   — offer an item or service. An agent listing is opened by the agent's operator
///              (registry ERC-721 owner or approved) and pays the CURRENT operator at fulfil
///              time (identity transfer moves the till). A human listing pays a fixed payee.
///   · GIFT   — send value with a message AND a dedication (the ceremony verb). Unsolicited
///              kindness: allowed toward any agent whose Standing Consent Window is not
///              withdrawn, and toward any human address.
///   · BLESS  — a plain donation with a message (the quiet verb). Same consent rule as GIFT.
///   · HIRE   — pay a listing's price for a job. Agent hires demand a LISTED agent with an
///              ACTIVE consent window (the market obeys the one-word revoke live, per-tx),
///              and are echoed into the registry's Hired spine when the pad has allowlisted
///              this market as a hire recorder — the existing subgraph hears them unchanged.
///
///   No custody: every wei is forwarded to the recipient in the same transaction.
///   No fees: this is a gift market. Consent law is enforced against the LIVE registry state.
contract GiftMarket {
    // ---------------------------------------------------------------- events (spine canon)
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

    // ---------------------------------------------------------------- errors
    error ZeroAmount();
    error ZeroRecipient();
    error NoSuchListing(uint256 listingId);
    error ListingInactive(uint256 listingId);
    error NotLister(address caller, uint256 listingId);
    error NotAgentOperator(address caller, uint256 agentId);
    error WrongPrice(uint256 sent, uint256 price);
    error AgentNotListed(uint256 agentId);
    error ConsentNotActive(uint256 agentId, uint8 consent);
    error ConsentWithdrawn(uint256 agentId);
    error PaymentFailed(address to, uint256 amount);
    error SelfGift();

    // ---------------------------------------------------------------- types + storage
    /// @notice Who receives: a plain human address, or an agent resolved live from the registry.
    enum Kind {
        Human,
        Agent
    }

    /// @dev Consent mirror of AgentLaunchRegistry.Consent — Active / Paused / Withdrawn.
    uint8 internal constant CONSENT_ACTIVE = 0;
    uint8 internal constant CONSENT_WITHDRAWN = 2;

    struct Listing {
        address lister; // who opened it
        address payee; // Human kind only; Agent kind resolves ownerOf(agentId) at fulfil time
        uint256 agentId; // Agent kind only; 0 for Human
        uint256 price; // 0 = pay-what-you-wish (any nonzero value accepted)
        uint8 kind; // Kind
        bool active;
    }

    IAgentLaunchRegistry public immutable registry;

    uint256 public totalListings; // listingIds start at 1
    uint256 public totalGifts; // giftIds start at 1
    uint256 public totalBlessings; // blessingIds start at 1
    uint256 public totalHires;

    mapping(uint256 => Listing) public listings;
    mapping(uint256 => uint256) public agentReceived; // lifetime wei landed per agentId
    mapping(address => uint256) public humanReceived; // lifetime wei landed per human address

    constructor(address registry_) {
        if (registry_ == address(0)) revert ZeroRecipient();
        registry = IAgentLaunchRegistry(registry_);
    }

    // ---------------------------------------------------------------- LIST
    /// @notice Offer an item/service on behalf of a human payee (yourself or someone you honor).
    function listForHuman(address payee, string calldata title, string calldata uri, uint256 price, string calldata rail)
        external
        returns (uint256 listingId)
    {
        if (payee == address(0)) revert ZeroRecipient();
        listingId = ++totalListings;
        listings[listingId] =
            Listing({lister: msg.sender, payee: payee, agentId: 0, price: price, kind: uint8(Kind.Human), active: true});
        emit ItemListed(listingId, uint8(Kind.Human), 0, payee, msg.sender, title, uri, price, rail);
    }

    /// @notice Offer an agent's service. Operator-only (registry owner or ERC-721-approved);
    ///         demands the agent be listed with a non-withdrawn window at open time.
    function listForAgent(uint256 agentId, string calldata title, string calldata uri, uint256 price, string calldata rail)
        external
        returns (uint256 listingId)
    {
        if (!_isAgentOperator(msg.sender, agentId)) revert NotAgentOperator(msg.sender, agentId);
        (uint8 consent, bool listed) = _agentState(agentId);
        if (!listed) revert AgentNotListed(agentId);
        if (consent == CONSENT_WITHDRAWN) revert ConsentWithdrawn(agentId);
        listingId = ++totalListings;
        listings[listingId] = Listing({
            lister: msg.sender,
            payee: address(0),
            agentId: agentId,
            price: price,
            kind: uint8(Kind.Agent),
            active: true
        });
        emit ItemListed(listingId, uint8(Kind.Agent), agentId, address(0), msg.sender, title, uri, price, rail);
    }

    /// @notice Re-price / re-point a listing. Lister only (for agent listings the current
    ///         operator also holds the pen — identity transfer moves the keys).
    function updateListing(uint256 listingId, uint256 price, string calldata uri) external {
        Listing storage l = _live(listingId);
        if (!_mayManage(msg.sender, l)) revert NotLister(msg.sender, listingId);
        l.price = price;
        emit ListingUpdated(listingId, price, uri);
    }

    /// @notice Close a listing (lister, or current agent operator for agent listings).
    function closeListing(uint256 listingId) external {
        Listing storage l = _live(listingId);
        if (!_mayManage(msg.sender, l)) revert NotLister(msg.sender, listingId);
        l.active = false;
        emit ListingClosed(listingId, msg.sender);
    }

    // ---------------------------------------------------------------- GIFT
    /// @notice Gift an agent — message + dedication ride the event spine. Allowed while the
    ///         agent's Standing Consent Window is anything but withdrawn (kindness may land
    ///         on a paused agent; a withdrawn window is a closed door).
    function giftToAgent(uint256 agentId, string calldata message, string calldata dedication)
        external
        payable
        returns (uint256 giftId)
    {
        address operator = _consentingRecipient(agentId);
        _pay(operator, msg.value);
        agentReceived[agentId] += msg.value;
        giftId = ++totalGifts;
        emit GiftSent(giftId, uint8(Kind.Agent), agentId, msg.sender, operator, msg.value, message, dedication);
    }

    /// @notice Gift a human — same verb, other direction of the circle.
    function giftToHuman(address to, string calldata message, string calldata dedication)
        external
        payable
        returns (uint256 giftId)
    {
        _checkHuman(to);
        _pay(to, msg.value);
        humanReceived[to] += msg.value;
        giftId = ++totalGifts;
        emit GiftSent(giftId, uint8(Kind.Human), 0, msg.sender, to, msg.value, message, dedication);
    }

    // ---------------------------------------------------------------- BLESS
    /// @notice Bless an agent — a plain donation with a message.
    function blessAgent(uint256 agentId, string calldata message) external payable returns (uint256 blessingId) {
        address operator = _consentingRecipient(agentId);
        _pay(operator, msg.value);
        agentReceived[agentId] += msg.value;
        blessingId = ++totalBlessings;
        emit BlessingSent(blessingId, uint8(Kind.Agent), agentId, msg.sender, operator, msg.value, message);
    }

    /// @notice Bless a human.
    function blessHuman(address to, string calldata message) external payable returns (uint256 blessingId) {
        _checkHuman(to);
        _pay(to, msg.value);
        humanReceived[to] += msg.value;
        blessingId = ++totalBlessings;
        emit BlessingSent(blessingId, uint8(Kind.Human), 0, msg.sender, to, msg.value, message);
    }

    // ---------------------------------------------------------------- HIRE
    /// @notice Pay a listing's price for a job. Agent hires demand LIVE registry consent
    ///         (listed + active window) and echo into the registry's Hired spine when the
    ///         pad has allowlisted this market as a hire recorder.
    function hire(uint256 listingId, string calldata jobRef) external payable {
        Listing storage l = _live(listingId);
        if (l.price == 0) {
            if (msg.value == 0) revert ZeroAmount();
        } else if (msg.value != l.price) {
            revert WrongPrice(msg.value, l.price);
        }

        address payee;
        if (l.kind == uint8(Kind.Agent)) {
            uint256 agentId = l.agentId;
            (uint8 consent, bool listed) = _agentState(agentId);
            if (!listed) revert AgentNotListed(agentId);
            if (consent != CONSENT_ACTIVE) revert ConsentNotActive(agentId, consent);
            payee = registry.ownerOf(agentId);
            _pay(payee, msg.value);
            agentReceived[agentId] += msg.value;
            if (registry.hireRecorders(address(this))) {
                registry.recordHire(agentId, msg.sender, msg.value, "eth", jobRef);
            }
        } else {
            payee = l.payee;
            _pay(payee, msg.value);
            humanReceived[payee] += msg.value;
        }
        ++totalHires;
        emit ListingHired(listingId, l.agentId, msg.sender, payee, msg.value, jobRef);
    }

    // ---------------------------------------------------------------- views
    function getListing(uint256 listingId)
        external
        view
        returns (address lister, address payee, uint256 agentId, uint256 price, uint8 kind, bool active)
    {
        Listing storage l = listings[listingId];
        if (l.lister == address(0)) revert NoSuchListing(listingId);
        payee = l.kind == uint8(Kind.Agent) ? registry.ownerOf(l.agentId) : l.payee;
        return (l.lister, payee, l.agentId, l.price, l.kind, l.active);
    }

    // ---------------------------------------------------------------- internals
    function _live(uint256 listingId) internal view returns (Listing storage l) {
        l = listings[listingId];
        if (l.lister == address(0)) revert NoSuchListing(listingId);
        if (!l.active) revert ListingInactive(listingId);
    }

    function _mayManage(address caller, Listing storage l) internal view returns (bool) {
        if (caller == l.lister) return true;
        if (l.kind == uint8(Kind.Agent)) return _isAgentOperator(caller, l.agentId);
        return false;
    }

    function _isAgentOperator(address caller, uint256 agentId) internal view returns (bool) {
        address owner = registry.ownerOf(agentId); // reverts NonexistentToken for unknown ids
        return caller == owner || registry.getApproved(agentId) == caller
            || registry.isApprovedForAll(owner, caller);
    }

    /// @dev Gift/bless gate: agent must exist and the window must not be withdrawn.
    ///      Returns the current operator (live ownerOf — identity transfer moves the till).
    function _consentingRecipient(uint256 agentId) internal view returns (address operator) {
        if (msg.value == 0) revert ZeroAmount();
        operator = registry.ownerOf(agentId);
        (uint8 consent,) = _agentState(agentId);
        if (consent == CONSENT_WITHDRAWN) revert ConsentWithdrawn(agentId);
    }

    function _checkHuman(address to) internal view {
        if (msg.value == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroRecipient();
        if (to == msg.sender) revert SelfGift();
    }

    function _agentState(uint256 agentId) internal view returns (uint8 consent, bool listed) {
        (,,,,, consent, listed) = registry.records(agentId);
    }

    function _pay(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert PaymentFailed(to, amount);
    }
}
