// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IPermissionedRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IRegistry.sol";
import {RegistryRolesLib} from "@ensdomains/contracts-v2/registry/libraries/RegistryRolesLib.sol";
import {IAgentSubnameIssuer} from "./AgentLaunchRegistry.sol";

/// @notice Minimal slice of the ENSv2 PermissionedResolver we drive (text records only).
///         Canonical source: contracts-v2/src/resolver/PermissionedResolver.sol `setText`.
interface IPermissionedResolverText {
    function setText(bytes32 node, string calldata key, string calldata value) external;
    function text(bytes32 node, string calldata key) external view returns (string memory);
}

/// @title ENSv2SubnameIssuer — the dedicated ENSv2 leg of the launch ceremony.
///
/// @notice Called ONLY by the AgentLaunchRegistry at launch / consent-flip time.
///   Launch: `register()` on the family's ENSv2 UserRegistry (a PermissionedRegistry proxy,
///     deployed via the Verifiable Factory and pointed at by `setSubregistry()` on the parent
///     name) mints `<label>.<family>.eth` as an ERC1155Singleton token owned by the AGENT
///     OPERATOR (true ownership — the operator receives the ETH Registrar's canonical
///     REGISTRATION_ROLE_BITMAP), then writes the Standing Consent Window as ENS text records
///     on the pad's PermissionedResolver:
///       consent.window = active · consent.contact · pit · agent.manifest · agent.service · agent.id
///   Consent flip: `syncConsent()` rewrites consent.window (+contact/pit) — the window any app
///     resolves in one lookup always mirrors the on-chain registry state.
///
/// Authorization the pad performs once (documented in contracts/README.md):
///   UserRegistry.grantRootRoles(ROLE_REGISTRAR | ROLE_RENEW, issuer)
///   Resolver.grantRootRoles(ROLE_SET_TEXT, issuer)     (root scope covers every subname node)
contract ENSv2SubnameIssuer is IAgentSubnameIssuer {
    /// @dev Same bitmap the ETH Registrar grants .eth owners at registration (tutorial canon):
    ///      manage own subregistry + resolver (+ delegate those), and transfer the name.
    uint256 public constant REGISTRATION_ROLE_BITMAP = RegistryRolesLib.ROLE_SET_SUBREGISTRY
        | RegistryRolesLib.ROLE_SET_SUBREGISTRY_ADMIN | RegistryRolesLib.ROLE_SET_RESOLVER
        | RegistryRolesLib.ROLE_SET_RESOLVER_ADMIN | RegistryRolesLib.ROLE_CAN_TRANSFER_ADMIN;

    error OnlyLaunchRegistry(address caller);

    event SubnameIssued(
        uint256 indexed agentId, string label, bytes32 indexed node, uint256 indexed ensTokenId, address operator
    );

    address public immutable launchRegistry;
    IPermissionedRegistry public immutable subnameRegistry; // UserRegistry of <family>.eth
    address public immutable resolver; // pad's PermissionedResolver proxy
    bytes32 public immutable parentNode; // namehash("<family>.eth")
    string public parentName; // informational, e.g. "agentohana.eth"

    modifier onlyLaunchRegistry() {
        if (msg.sender != launchRegistry) revert OnlyLaunchRegistry(msg.sender);
        _;
    }

    constructor(
        address launchRegistry_,
        IPermissionedRegistry subnameRegistry_,
        address resolver_,
        bytes32 parentNode_,
        string memory parentName_
    ) {
        launchRegistry = launchRegistry_;
        subnameRegistry = subnameRegistry_;
        resolver = resolver_;
        parentNode = parentNode_;
        parentName = parentName_;
    }

    /// @inheritdoc IAgentSubnameIssuer
    function issue(
        uint256 agentId,
        string calldata label,
        address operator,
        string calldata manifestURI,
        string calldata serviceEndpoint,
        string calldata consentContact,
        string calldata pitPointer,
        uint64 expiry
    ) external onlyLaunchRegistry returns (bytes32 node, uint256 tokenId) {
        tokenId = subnameRegistry.register(
            label, operator, IRegistry(address(0)), resolver, REGISTRATION_ROLE_BITMAP, expiry
        );
        node = keccak256(abi.encodePacked(parentNode, keccak256(bytes(label)))); // ENS namehash recursion

        IPermissionedResolverText r = IPermissionedResolverText(resolver);
        r.setText(node, "consent.window", "active");
        r.setText(node, "consent.contact", consentContact);
        r.setText(node, "pit", pitPointer);
        r.setText(node, "agent.manifest", manifestURI);
        r.setText(node, "agent.service", serviceEndpoint);
        r.setText(node, "agent.id", _toString(agentId));

        emit SubnameIssued(agentId, label, node, tokenId, operator);
    }

    /// @inheritdoc IAgentSubnameIssuer
    function syncConsent(
        bytes32 node,
        string calldata windowText,
        string calldata consentContact,
        string calldata pitPointer
    ) external onlyLaunchRegistry {
        IPermissionedResolverText r = IPermissionedResolverText(resolver);
        r.setText(node, "consent.window", windowText);
        r.setText(node, "consent.contact", consentContact);
        r.setText(node, "pit", pitPointer);
    }

    function _toString(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 len;
        for (uint256 t = v; t != 0; t /= 10) len++;
        bytes memory out = new bytes(len);
        while (v != 0) {
            out[--len] = bytes1(uint8(48 + (v % 10)));
            v /= 10;
        }
        return string(out);
    }
}
