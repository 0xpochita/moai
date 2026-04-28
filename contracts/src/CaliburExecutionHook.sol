// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CaliburExecutionHook
/// @notice Per-call execution validator that plugs into the Calibur smart-wallet
///         singleton's hook slot. Each call inside an agent-signed batch is
///         filtered through `beforeExecute(keyHash, to, value, data)`. Calls
///         that don't pass the immutable rules below revert the whole batch.
///
///         Two parallel allow-lists (same model as the standalone hook):
///         1. `(target, selector)` pairs — for routine protocol calls.
///         2. `spender` allow-list — used to validate the *argument* of
///            `IERC20.approve` and `Permit2.approve` calls. The agent can
///            approve any token to a known router without the token needing
///            to be pre-listed, while approvals to attacker-controlled
///            spenders revert.
///
///         `afterExecute` is a no-op — we don't need post-call validation.
///         Both functions return their own selector to satisfy Calibur's
///         hook interface.
contract CaliburExecutionHook {
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

    /// @dev IExecutionHook.beforeExecute.selector
    bytes4 public constant BEFORE_EXECUTE_SELECTOR =
        bytes4(keccak256("beforeExecute(bytes32,address,uint256,bytes)"));
    /// @dev IExecutionHook.afterExecute.selector
    bytes4 public constant AFTER_EXECUTE_SELECTOR =
        bytes4(keccak256("afterExecute(bytes32,bool,bytes,bytes)"));

    error CallNotAllowed(address target, bytes4 selector);
    error SpenderNotAllowed(address spender);
    error EmptyCallData();

    event WhitelistEntryAdded(address indexed target, bytes4 indexed selector);
    event AllowedSpenderAdded(address indexed spender);

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

    /// @notice Calibur hook entrypoint. Reverts to abort the inner call.
    /// @return selector Must equal `IExecutionHook.beforeExecute.selector`.
    /// @return context  Returned to `afterExecute`. Empty for us.
    function beforeExecute(
        bytes32 /* keyHash */,
        address to,
        uint256 /* value */,
        bytes calldata data
    ) external view returns (bytes4, bytes memory) {
        if (data.length < 4) revert EmptyCallData();
        bytes4 sel;
        assembly {
            sel := calldataload(data.offset)
        }
        _validate(to, sel, data);
        return (BEFORE_EXECUTE_SELECTOR, "");
    }

    /// @notice Calibur hook entrypoint. No-op for us; just returns the selector.
    /// @return selector Must equal `IExecutionHook.afterExecute.selector`.
    function afterExecute(
        bytes32 /* keyHash */,
        bool /* success */,
        bytes calldata /* output */,
        bytes calldata /* beforeExecuteData */
    ) external pure returns (bytes4) {
        return AFTER_EXECUTE_SELECTOR;
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
}
