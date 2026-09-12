// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MinimalERC721 — hand-rolled ERC-721 core for agent identity tokens.
/// @dev  No external dependency: keeps the spine auditable inside the hackathon window.
///       ERC-8004's Identity Registry is "ERC-721 with URIStorage": tokenId == agentId,
///       tokenURI == agentURI. The metadata extension lives in the child contract.
abstract contract MinimalERC721 {
    string public name;
    string public symbol;

    mapping(uint256 => address) internal _owners;
    mapping(address => uint256) internal _balances;
    mapping(uint256 => address) internal _tokenApprovals;
    mapping(address => mapping(address => bool)) internal _operatorApprovals;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    error NonexistentToken(uint256 tokenId);
    error NotOwnerNorApproved(address caller, uint256 tokenId);
    error ZeroAddress();
    error NotTokenOwner();
    error UnsafeRecipient();

    constructor(string memory name_, string memory symbol_) {
        name = name_;
        symbol = symbol_;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
        return interfaceId == 0x01ffc9a7 // ERC165
            || interfaceId == 0x80ac58cd // ERC721
            || interfaceId == 0x5b5e139f; // ERC721Metadata
    }

    function balanceOf(address owner) public view returns (uint256) {
        if (owner == address(0)) revert ZeroAddress();
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) public view virtual returns (address) {
        address owner = _owners[tokenId];
        if (owner == address(0)) revert NonexistentToken(tokenId);
        return owner;
    }

    function tokenURI(uint256 tokenId) public view virtual returns (string memory);

    function approve(address to, uint256 tokenId) public {
        address owner = ownerOf(tokenId);
        if (msg.sender != owner && !_operatorApprovals[owner][msg.sender]) revert NotTokenOwner();
        _tokenApprovals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }

    function getApproved(uint256 tokenId) public view returns (address) {
        ownerOf(tokenId);
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) public {
        if (operator == address(0)) revert ZeroAddress();
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address owner, address operator) public view returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public virtual {
        if (!_isApprovedOrOwner(msg.sender, tokenId)) revert NotOwnerNorApproved(msg.sender, tokenId);
        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) public {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        transferFrom(from, to, tokenId);
        if (!_checkOnERC721Received(from, to, tokenId, data)) revert UnsafeRecipient();
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = ownerOf(tokenId);
        return spender == owner || _tokenApprovals[tokenId] == spender || _operatorApprovals[owner][spender];
    }

    function _transfer(address from, address to, uint256 tokenId) internal {
        if (ownerOf(tokenId) != from) revert NotTokenOwner();
        if (to == address(0)) revert ZeroAddress();
        delete _tokenApprovals[tokenId];
        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;
        emit Transfer(from, to, tokenId);
    }

    function _mint(address to, uint256 tokenId) internal {
        if (to == address(0)) revert ZeroAddress();
        if (_owners[tokenId] != address(0)) revert NonexistentToken(tokenId); // reuse as "already exists"
        _balances[to] += 1;
        _owners[tokenId] = to;
        emit Transfer(address(0), to, tokenId);
    }

    function _checkOnERC721Received(address from, address to, uint256 tokenId, bytes memory data)
        private
        returns (bool)
    {
        if (to.code.length == 0) return true;
        (bool ok, bytes memory ret) =
            to.call(abi.encodeWithSelector(0x150b7a02, msg.sender, from, tokenId, data));
        return ok && ret.length >= 32 && abi.decode(ret, (bytes4)) == 0x150b7a02;
    }
}
