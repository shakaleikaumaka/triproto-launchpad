// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MinimalERC721} from "./MinimalERC721.sol";

/// @notice The dedicated-ENSv2 subname issuer wired to this registry (zero address = fallback mode).
interface IAgentSubnameIssuer {
    function issue(
        uint256 agentId,
        string calldata label,
        address operator,
        string calldata manifestURI,
        string calldata serviceEndpoint,
        string calldata consentContact,
        string calldata pitPointer,
        uint64 expiry
    ) external returns (bytes32 node, uint256 tokenId);

    function syncConsent(bytes32 node, string calldata windowText, string calldata consentContact, string calldata pitPointer)
        external;
}

/// @title AgentLaunchRegistry — My Agent ʻOhana · the Tri-Proto Launchpad spine (Lane A).
///
/// @notice ONE launch ceremony mints, atomically:
///   (a) an ERC-8004-aligned identity record  — ERC-721 tokenId == agentId, tokenURI == agentURI
///       (manifest), plus getMetadata/setMetadata + Registered/MetadataSet events per the draft EIP;
///   (b) an ENSv2 subname assignment          — in dedicated mode the wired IAgentSubnameIssuer
///       registers `<label>.<family>.eth` on an ENSv2 PermissionedRegistry and writes the consent
///       text records on a PermissionedResolver; in fallback mode the label is stored and the pad
///       anchors the node afterwards with `anchorSubname()`;
///   (c) the Standing Consent Window          — consent.window = active|paused|withdrawn plus
///       consent.contact + PIT pointer, kept both as registry fields/events AND as ENS text records;
///   (d) the event spine for The Graph lane   — AgentLaunched · ConsentChanged · Delisted ·
///       Relisted · SubnameAssigned · Hired · Blessed (+ ERC-8004 Registered/MetadataSet/URIUpdated).
///
/// Consent law: the operator (token owner or ERC-721-approved) alone flips the window.
/// `withdrawn` is a one-way door and auto-delists (the one-word revoke from the white paper).
/// The pad may `delist()` for moderation and `relist()` after review (relist resets a withdrawn
/// window to paused so the operator may re-activate). Transferring the identity NFT transfers
/// operatorship — the new operator holds the consent keys.
contract AgentLaunchRegistry is MinimalERC721 {
    // ---------------------------------------------------------------- events
    // ERC-8004 Identity Registry alignment
    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event MetadataSet(
        uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue
    );
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);
    // Launchpad spine (L4 — subgraph canon)
    event AgentLaunched(
        uint256 indexed agentId,
        address indexed operator,
        bytes32 indexed manifestHash,
        string manifestURI,
        string serviceEndpoint,
        string label,
        uint64 expiry
    );
    event ConsentChanged(
        uint256 indexed agentId, uint8 indexed status, address indexed changedBy, string consentContact, string pitPointer
    );
    event Delisted(uint256 indexed agentId, address indexed delistedBy, string reason);
    event Relisted(uint256 indexed agentId, address indexed relistedBy);
    event SubnameAssigned(uint256 indexed agentId, string label, bytes32 indexed node, uint256 ensTokenId);
    event Hired(uint256 indexed agentId, address indexed client, uint256 amount, string rail, string receiptRef);
    event Blessed(uint256 indexed agentId, address indexed operator, string verifier, string proofRef);
    event SubnameIssuerUpdated(address indexed issuer);

    // ---------------------------------------------------------------- errors
    error NotPad();
    error NotPadOrOperator();
    error NotOperator(address caller, uint256 agentId);
    error ZeroOperator();
    error EmptyManifest();
    error EmptyLabel();
    error NotListed(uint256 agentId);
    error AlreadyDelisted(uint256 agentId);
    error ConsentFinal(uint256 agentId);
    error SubnameAlreadyAnchored(uint256 agentId);
    error ReservedKey(string key);
    error CanonicalKey(string key);
    error NotRecorder(address caller);
    error NotBlesser(address caller);

    // ---------------------------------------------------------------- types + storage
    enum Consent {
        Active,
        Paused,
        Withdrawn
    }

    struct AgentRecord {
        bytes32 manifestHash; // keccak256 of the manifest the manifestURI resolves to
        bytes32 ensNode; // namehash(<label>.<family>.eth), 0 until assigned/anchored
        uint256 ensTokenId; // ENSv2 ERC1155Singleton token id, 0 until assigned/anchored
        uint64 launchedAt;
        uint64 expiry; // subname expiry (type(uint64).max = permanent)
        uint8 consent; // Consent
        bool listed;
    }

    bytes32 private constant K_AGENT_WALLET = keccak256("agentWallet"); // ERC-8004 reserved
    bytes32 private constant K_MANIFEST_URI = keccak256("manifestURI");
    bytes32 private constant K_MANIFEST_HASH = keccak256("manifestHash");
    bytes32 private constant K_SERVICE_ENDPOINT = keccak256("serviceEndpoint");
    bytes32 private constant K_ENS_LABEL = keccak256("ensLabel");
    bytes32 private constant K_CONSENT_WINDOW = keccak256("consent.window");
    bytes32 private constant K_CONSENT_CONTACT = keccak256("consent.contact");
    bytes32 private constant K_PIT = keccak256("pit");

    address public pad; // the launchpad operator (Shaka's pad wallet)
    string public familyName; // informational: the ENS family, e.g. "agentohana.eth"
    IAgentSubnameIssuer public subnameIssuer; // zero => fallback mode (label-only)

    uint256 public totalAgents; // agentIds start at 1
    mapping(uint256 => AgentRecord) public records;
    mapping(uint256 => mapping(string => bytes)) internal _metadata; // ERC-8004 on-chain metadata
    mapping(uint256 => string) internal _agentURIs;

    mapping(address => bool) public hireRecorders; // x402 rails may post Hired receipts
    mapping(address => bool) public blessers; // trust lanes (World lane) may post Blessed

    modifier onlyPad() {
        if (msg.sender != pad) revert NotPad();
        _;
    }

    constructor(string memory name_, string memory symbol_, address pad_, string memory familyName_)
        MinimalERC721(name_, symbol_)
    {
        if (pad_ == address(0)) revert ZeroOperator();
        pad = pad_;
        familyName = familyName_;
    }

    // ---------------------------------------------------------------- launch
    /// @notice The launch ceremony. Callable by the pad, or by the operator self-launching.
    /// @param duration subname lifetime in seconds; 0 => permanent (type(uint64).max expiry).
    function launchAgent(
        address operator,
        string calldata manifestURI,
        bytes32 manifestHash,
        string calldata serviceEndpoint,
        string calldata label,
        string calldata consentContact,
        string calldata pitPointer,
        uint64 duration
    ) external returns (uint256 agentId) {
        if (msg.sender != pad && msg.sender != operator) revert NotPadOrOperator();
        if (operator == address(0)) revert ZeroOperator();
        if (bytes(manifestURI).length == 0) revert EmptyManifest();
        if (bytes(label).length == 0) revert EmptyLabel();

        uint64 expiry = duration == 0 ? type(uint64).max : uint64(block.timestamp) + duration;
        agentId = ++totalAgents;
        _mint(operator, agentId);
        _agentURIs[agentId] = manifestURI;
        records[agentId] = AgentRecord({
            manifestHash: manifestHash,
            ensNode: bytes32(0),
            ensTokenId: 0,
            launchedAt: uint64(block.timestamp),
            expiry: expiry,
            consent: uint8(Consent.Active),
            listed: true
        });

        _setMeta(agentId, "manifestHash", bytes.concat(manifestHash));
        _setMeta(agentId, "serviceEndpoint", bytes(serviceEndpoint));
        _setMeta(agentId, "ensLabel", bytes(label));
        _setMeta(agentId, "consent.window", bytes("active"));
        _setMeta(agentId, "consent.contact", bytes(consentContact));
        _setMeta(agentId, "pit", bytes(pitPointer));

        emit Registered(agentId, manifestURI, operator);
        emit AgentLaunched(agentId, operator, manifestHash, manifestURI, serviceEndpoint, label, expiry);

        if (address(subnameIssuer) != address(0)) {
            (bytes32 node, uint256 ensTokenId) = subnameIssuer.issue(
                agentId, label, operator, manifestURI, serviceEndpoint, consentContact, pitPointer, expiry
            );
            records[agentId].ensNode = node;
            records[agentId].ensTokenId = ensTokenId;
            emit SubnameAssigned(agentId, label, node, ensTokenId);
        }
    }

    /// @notice ERC-8004 bare registration: identity only (unlisted, window paused, no subname).
    function register(string calldata agentURI) external returns (uint256 agentId) {
        agentId = ++totalAgents;
        _mint(msg.sender, agentId);
        _agentURIs[agentId] = agentURI;
        records[agentId] = AgentRecord({
            manifestHash: bytes32(0),
            ensNode: bytes32(0),
            ensTokenId: 0,
            launchedAt: uint64(block.timestamp),
            expiry: 0,
            consent: uint8(Consent.Paused),
            listed: false
        });
        emit Registered(agentId, agentURI, msg.sender);
    }

    // ---------------------------------------------------------------- consent window
    /// @notice The Standing Consent Window — operator-only. `Withdrawn` is final and auto-delists.
    function setConsent(uint256 agentId, Consent status, string calldata consentContact, string calldata pitPointer)
        external
    {
        if (!_isApprovedOrOwner(msg.sender, agentId)) revert NotOperator(msg.sender, agentId);
        AgentRecord storage r = records[agentId];
        if (!r.listed) revert NotListed(agentId);
        if (r.consent == uint8(Consent.Withdrawn)) revert ConsentFinal(agentId);

        r.consent = uint8(status);
        string memory windowText = _windowText(status);
        _setMeta(agentId, "consent.window", bytes(windowText));
        _setMeta(agentId, "consent.contact", bytes(consentContact));
        _setMeta(agentId, "pit", bytes(pitPointer));
        emit ConsentChanged(agentId, uint8(status), msg.sender, consentContact, pitPointer);
        _syncIssuer(r, windowText, consentContact, pitPointer);

        if (status == Consent.Withdrawn) {
            r.listed = false; // the one-word revoke: marketplace delists in the same tx
            emit Delisted(agentId, msg.sender, "consent withdrawn");
        }
    }

    /// @notice Moderation delist (pad or operator). Consent state itself is untouched.
    function delist(uint256 agentId, string calldata reason) external {
        bool isOperator = _isApprovedOrOwner(msg.sender, agentId);
        if (msg.sender != pad && !isOperator) revert NotPadOrOperator();
        AgentRecord storage r = records[agentId];
        if (!r.listed) revert AlreadyDelisted(agentId);
        r.listed = false;
        emit Delisted(agentId, msg.sender, reason);
    }

    /// @notice Pad-only relist after review. A withdrawn window resets to paused so the operator
    ///         may re-activate; any other consent state is preserved.
    function relist(uint256 agentId) external onlyPad {
        AgentRecord storage r = records[agentId];
        if (r.listed) revert NotListed(agentId); // reuse: "nothing to relist"
        r.listed = true;
        emit Relisted(agentId, msg.sender);
        if (r.consent == uint8(Consent.Withdrawn)) {
            r.consent = uint8(Consent.Paused);
            string memory contact = string(_metadata[agentId]["consent.contact"]);
            string memory pit = string(_metadata[agentId]["pit"]);
            _setMeta(agentId, "consent.window", bytes("paused"));
            emit ConsentChanged(agentId, uint8(Consent.Paused), msg.sender, contact, pit);
            _syncIssuer(r, "paused", contact, pit);
        }
    }

    // ---------------------------------------------------------------- ENSv2 subname plumbing
    function setSubnameIssuer(address issuer) external onlyPad {
        subnameIssuer = IAgentSubnameIssuer(issuer);
        emit SubnameIssuerUpdated(issuer);
    }

    /// @notice Fallback mode: after the pad registers the subname + writes the consent text records
    ///         manually (ENS app / cast / viem recipe in contracts/README.md), anchor the result.
    function anchorSubname(uint256 agentId, bytes32 node, uint256 ensTokenId) external onlyPad {
        ownerOf(agentId);
        AgentRecord storage r = records[agentId];
        if (r.ensNode != bytes32(0)) revert SubnameAlreadyAnchored(agentId);
        r.ensNode = node;
        r.ensTokenId = ensTokenId;
        string memory label = string(_metadata[agentId]["ensLabel"]);
        emit SubnameAssigned(agentId, label, node, ensTokenId);
    }

    // ---------------------------------------------------------------- trust + hire lanes
    function setHireRecorder(address recorder, bool allowed) external onlyPad {
        hireRecorders[recorder] = allowed;
    }

    function setBlesser(address blesser, bool allowed) external onlyPad {
        blessers[blesser] = allowed;
    }

    /// @notice x402 hire receipt — emitted by an allowlisted rail when a paid job lands.
    function recordHire(uint256 agentId, address client, uint256 amount, string calldata rail, string calldata receiptRef)
        external
    {
        if (!hireRecorders[msg.sender]) revert NotRecorder(msg.sender);
        ownerOf(agentId);
        emit Hired(agentId, client, amount, rail, receiptRef);
    }

    /// @notice Trust mark (e.g. World Selfie Check verified operator) — allowlisted blessers.
    function bless(uint256 agentId, string calldata verifier, string calldata proofRef) external {
        if (!blessers[msg.sender]) revert NotBlesser(msg.sender);
        emit Blessed(agentId, ownerOf(agentId), verifier, proofRef);
    }

    // ---------------------------------------------------------------- ERC-8004 metadata surface
    function tokenURI(uint256 agentId) public view override returns (string memory) {
        ownerOf(agentId);
        return _agentURIs[agentId];
    }

    function setAgentURI(uint256 agentId, string calldata newURI) external {
        if (!_isApprovedOrOwner(msg.sender, agentId)) revert NotOperator(msg.sender, agentId);
        _agentURIs[agentId] = newURI;
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    /// @notice Re-bind the manifest content hash (pair with setAgentURI when the manifest moves).
    function updateManifestHash(uint256 agentId, bytes32 newHash) external {
        if (!_isApprovedOrOwner(msg.sender, agentId)) revert NotOperator(msg.sender, agentId);
        records[agentId].manifestHash = newHash;
        _setMeta(agentId, "manifestHash", bytes.concat(newHash));
    }

    function getMetadata(uint256 agentId, string memory metadataKey) public view returns (bytes memory) {
        ownerOf(agentId);
        if (keccak256(bytes(metadataKey)) == K_MANIFEST_URI) return bytes(_agentURIs[agentId]);
        return _metadata[agentId][metadataKey];
    }

    /// @dev agentWallet is ERC-8004-reserved; canonical launch fields are lifecycle-managed only.
    function setMetadata(uint256 agentId, string memory metadataKey, bytes memory metadataValue) external {
        if (!_isApprovedOrOwner(msg.sender, agentId)) revert NotOperator(msg.sender, agentId);
        bytes32 k = keccak256(bytes(metadataKey));
        if (k == K_AGENT_WALLET) revert ReservedKey(metadataKey);
        if (
            k == K_MANIFEST_URI || k == K_MANIFEST_HASH || k == K_SERVICE_ENDPOINT || k == K_ENS_LABEL
                || k == K_CONSENT_WINDOW || k == K_CONSENT_CONTACT || k == K_PIT
        ) revert CanonicalKey(metadataKey);
        _setMeta(agentId, metadataKey, metadataValue);
    }

    // ---------------------------------------------------------------- views
    function getAgent(uint256 agentId)
        external
        view
        returns (
            address operator,
            string memory manifestURI,
            bytes32 manifestHash,
            string memory serviceEndpoint,
            string memory ensLabel,
            bytes32 ensNode,
            uint256 ensTokenId,
            uint8 consent,
            bool listed,
            uint64 launchedAt,
            uint64 expiry
        )
    {
        operator = ownerOf(agentId);
        AgentRecord storage r = records[agentId];
        return (
            operator,
            _agentURIs[agentId],
            r.manifestHash,
            string(_metadata[agentId]["serviceEndpoint"]),
            string(_metadata[agentId]["ensLabel"]),
            r.ensNode,
            r.ensTokenId,
            r.consent,
            r.listed,
            r.launchedAt,
            r.expiry
        );
    }

    /// @notice True iff the supplied bytes hash to the stored manifest hash (demo + audit helper).
    function verifyManifest(uint256 agentId, bytes calldata manifestBytes) external view returns (bool) {
        return records[agentId].manifestHash == keccak256(manifestBytes);
    }

    // ---------------------------------------------------------------- admin
    function transferPad(address newPad) external onlyPad {
        if (newPad == address(0)) revert ZeroOperator();
        pad = newPad;
    }

    // ---------------------------------------------------------------- internals
    function _setMeta(uint256 agentId, string memory key, bytes memory value) internal {
        _metadata[agentId][key] = value;
        emit MetadataSet(agentId, key, key, value);
    }

    function _windowText(Consent status) internal pure returns (string memory) {
        if (status == Consent.Active) return "active";
        if (status == Consent.Paused) return "paused";
        return "withdrawn";
    }

    function _syncIssuer(
        AgentRecord storage r,
        string memory windowText,
        string memory consentContact,
        string memory pitPointer
    ) internal {
        if (address(subnameIssuer) != address(0) && r.ensNode != bytes32(0)) {
            subnameIssuer.syncConsent(r.ensNode, windowText, consentContact, pitPointer);
        }
    }
}
