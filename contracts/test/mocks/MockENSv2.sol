// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IRegistry.sol";

/// @notice Test double for the ENSv2 UserRegistry (PermissionedRegistry proxy).
///         Same register() signature as IStandardRegistry; records call args for assertions;
///         gates register() on a registrar address (stands in for ROLE_REGISTRAR on ROOT).
contract MockENSRegistry {
    error NotRegistrar(address caller);
    error LabelTaken(string label);

    address public registrar;
    uint256 public nextTokenId = 1000;

    string public lastLabel;
    address public lastOwner;
    address public lastResolver;
    uint256 public lastRoleBitmap;
    uint64 public lastExpiry;
    uint256 public registerCalls;
    mapping(bytes32 => bool) public taken; // labelhash => registered

    function setRegistrar(address registrar_) external {
        registrar = registrar_;
    }

    function register(
        string calldata label,
        address owner,
        IRegistry, /* subregistry */
        address resolver,
        uint256 roleBitmap,
        uint64 expiry
    ) external returns (uint256 tokenId) {
        if (msg.sender != registrar) revert NotRegistrar(msg.sender);
        bytes32 lh = keccak256(bytes(label));
        if (taken[lh]) revert LabelTaken(label);
        taken[lh] = true;
        lastLabel = label;
        lastOwner = owner;
        lastResolver = resolver;
        lastRoleBitmap = roleBitmap;
        lastExpiry = expiry;
        registerCalls++;
        return nextTokenId++;
    }
}

/// @notice Test double for the pad's ENSv2 PermissionedResolver (text records only).
contract MockENSResolver {
    mapping(bytes32 => mapping(string => string)) public texts;
    uint256 public setTextCalls;
    string public lastKey;
    string public lastValue;

    function setText(bytes32 node, string calldata key, string calldata value) external {
        texts[node][key] = value;
        setTextCalls++;
        lastKey = key;
        lastValue = value;
    }

    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return texts[node][key];
    }
}
