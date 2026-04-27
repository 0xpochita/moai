// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GuardedExecutorHook
/// @notice Immutable whitelist of (target, selector) pairs that gate every
///         agent call against the delegated EOA. Calls outside the whitelist
///         revert. Designed to pair with EIP-7702 (delegate target) or with
///         a smart-account implementation like Calibur (validation hook).
contract GuardedExecutorHook {
    struct Call {
        address target;
        uint256 value;
        bytes data;
    }

    struct WhitelistEntry {
        address target;
        bytes4 selector;
    }

    /// @dev keccak256(abi.encodePacked(target, selector)) => allowed
    mapping(bytes32 => bool) public isAllowed;

    address public immutable deployer;

    error CallNotAllowed(address target, bytes4 selector);
    error EmptyCallData(uint256 index);
    error CallFailed(uint256 index, bytes returnData);

    event WhitelistEntryAdded(address indexed target, bytes4 indexed selector);
    event Executed(address indexed sender, uint256 callCount);

    constructor(WhitelistEntry[] memory entries) {
        deployer = msg.sender;
        uint256 len = entries.length;
        for (uint256 i; i < len; ++i) {
            bytes32 key = _key(entries[i].target, entries[i].selector);
            if (!isAllowed[key]) {
                isAllowed[key] = true;
                emit WhitelistEntryAdded(entries[i].target, entries[i].selector);
            }
        }
    }

    /// @notice Returns true if (target, selector) is in the immutable whitelist.
    function allowed(address target, bytes4 selector)
        external
        view
        returns (bool)
    {
        return isAllowed[_key(target, selector)];
    }

    /// @notice Reverts if any call's (target, selector) is not in the whitelist.
    function validate(Call[] calldata calls) public view {
        uint256 len = calls.length;
        for (uint256 i; i < len; ++i) {
            if (calls[i].data.length < 4) revert EmptyCallData(i);
            bytes4 sel;
            bytes calldata data = calls[i].data;
            assembly {
                sel := calldataload(data.offset)
            }
            if (!isAllowed[_key(calls[i].target, sel)]) {
                revert CallNotAllowed(calls[i].target, sel);
            }
        }
    }

    /// @notice Validates and then forwards every call. Any inner revert
    ///         propagates and reverts the whole batch.
    function execute(Call[] calldata calls) external payable {
        validate(calls);
        uint256 len = calls.length;
        for (uint256 i; i < len; ++i) {
            (bool ok, bytes memory ret) =
                calls[i].target.call{value: calls[i].value}(calls[i].data);
            if (!ok) revert CallFailed(i, ret);
        }
        emit Executed(msg.sender, len);
    }

    function _key(address target, bytes4 selector) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(target, selector));
    }

    receive() external payable {}
}
