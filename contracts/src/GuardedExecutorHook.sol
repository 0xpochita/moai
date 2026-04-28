// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GuardedExecutorHook
/// @notice Immutable validator that gates every agent call against the
///         delegated EOA. Pairs with EIP-7702 (delegate target) so the
///         keeper can submit batches without ever holding user funds.
///
///         Two parallel allow-lists:
///         1. (target, selector) pairs — for routine protocol calls (burn LP,
///            UniversalRouter.execute, LiFi diamond entrypoints, ...).
///         2. spender allow-list — used to validate the *argument* of approve
///            calls (ERC20.approve and Permit2.approve). This lets the agent
///            approve any token to a known router without needing the token
///            address pre-whitelisted, while still preventing the agent from
///            approving an attacker-controlled spender that could drain
///            balances.
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
    /// @dev spender (router/diamond) addresses approve calls may target
    mapping(address => bool) public isAllowedSpender;

    address public immutable deployer;

    /// @dev IERC20.approve(address spender, uint256 amount)
    bytes4 public constant ERC20_APPROVE_SELECTOR = 0x095ea7b3;
    /// @dev Permit2.approve(address token, address spender, uint160 amount, uint48 expiration)
    bytes4 public constant PERMIT2_APPROVE_SELECTOR = 0x87517c45;

    error CallNotAllowed(address target, bytes4 selector);
    error SpenderNotAllowed(address spender);
    error EmptyCallData(uint256 index);
    error CallFailed(uint256 index, bytes returnData);

    event WhitelistEntryAdded(address indexed target, bytes4 indexed selector);
    event AllowedSpenderAdded(address indexed spender);
    event Executed(address indexed sender, uint256 callCount);

    constructor(
        WhitelistEntry[] memory entries,
        address[] memory allowedSpenders
    ) {
        deployer = msg.sender;
        uint256 lenEntries = entries.length;
        for (uint256 i; i < lenEntries; ++i) {
            bytes32 key = _key(entries[i].target, entries[i].selector);
            if (!isAllowed[key]) {
                isAllowed[key] = true;
                emit WhitelistEntryAdded(entries[i].target, entries[i].selector);
            }
        }
        uint256 lenSpenders = allowedSpenders.length;
        for (uint256 i; i < lenSpenders; ++i) {
            address spender = allowedSpenders[i];
            if (spender != address(0) && !isAllowedSpender[spender]) {
                isAllowedSpender[spender] = true;
                emit AllowedSpenderAdded(spender);
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
            bytes calldata data = calls[i].data;
            bytes4 sel;
            assembly {
                sel := calldataload(data.offset)
            }
            _validate(calls[i].target, sel, data);
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

    function _validate(address target, bytes4 selector, bytes calldata data)
        private
        view
    {
        // ERC20.approve(address spender, uint256 amount)
        if (selector == ERC20_APPROVE_SELECTOR) {
            if (data.length < 4 + 32 + 32) {
                revert CallNotAllowed(target, selector);
            }
            address spender;
            assembly {
                spender := calldataload(add(data.offset, 4))
            }
            if (!isAllowedSpender[spender]) {
                revert SpenderNotAllowed(spender);
            }
            return;
        }
        // Permit2.approve(address token, address spender, uint160 amount, uint48 expiration)
        if (selector == PERMIT2_APPROVE_SELECTOR) {
            if (data.length < 4 + 32 * 4) {
                revert CallNotAllowed(target, selector);
            }
            address spender;
            assembly {
                spender := calldataload(add(data.offset, 36))
            }
            if (!isAllowedSpender[spender]) {
                revert SpenderNotAllowed(spender);
            }
            return;
        }
        if (!isAllowed[_key(target, selector)]) {
            revert CallNotAllowed(target, selector);
        }
    }

    function _key(address target, bytes4 selector) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(target, selector));
    }

    receive() external payable {}
}
