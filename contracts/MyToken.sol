// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract MyToken is ERC20, ERC20Permit, ERC20Votes {
    address public governor;
    address private _owner;

    constructor() ERC20("EMO-Governor", "EMO-G") ERC20Permit("EMO-Permit") {
        _owner = msg.sender;
        _mint(msg.sender, 10000e18);
    }

    function setGovernor(address _governor) external {
        require(msg.sender == _owner, "Only owner");
        require(governor == address(0), "Governor already set");
        governor = _governor;
    }

    function mint(address to, uint256 amount) external {
        require(governor == msg.sender);
        _mint(to, amount);
    }

    // The functions below are overrides required by Solidity.

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Votes) {
        super._mint(to, amount);
    }

    function _burn(
        address account,
        uint256 amount
    ) internal override(ERC20, ERC20Votes) {
        super._burn(account, amount);
    }
}

