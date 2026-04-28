// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CaliburExecutionHook} from "../src/CaliburExecutionHook.sol";

contract CaliburExecutionHookTest is Test {
    CaliburExecutionHook hook;

    address constant TARGET = address(0xCAFE0001);
    address constant ALLOWED_SPENDER = address(0xC0FFEE);
    address constant DENIED_SPENDER = address(0xBAD);
    bytes32 constant DUMMY_KEY_HASH = bytes32(uint256(1));

    bytes4 constant BUMP_SELECTOR = bytes4(keccak256("bump()"));
    bytes4 constant TRANSFER_SELECTOR =
        bytes4(keccak256("transfer(address,uint256)"));
    bytes4 constant ERC20_APPROVE = 0x095ea7b3;
    bytes4 constant PERMIT2_APPROVE = 0x87517c45;

    bytes4 constant BEFORE_EXECUTE = bytes4(
        keccak256("beforeExecute(bytes32,address,uint256,bytes)")
    );
    bytes4 constant AFTER_EXECUTE = bytes4(
        keccak256("afterExecute(bytes32,bool,bytes,bytes)")
    );

    function setUp() public {
        CaliburExecutionHook.WhitelistEntry[] memory entries =
            new CaliburExecutionHook.WhitelistEntry[](1);
        entries[0] = CaliburExecutionHook.WhitelistEntry({
            target: TARGET,
            selector: BUMP_SELECTOR
        });

        address[] memory spenders = new address[](1);
        spenders[0] = ALLOWED_SPENDER;

        hook = new CaliburExecutionHook(entries, spenders);
    }

    // ─── beforeExecute, whitelist path ─────────────────────────────────

    function test_beforeExecute_passes_whitelisted_call() public view {
        bytes memory data = abi.encodeWithSelector(BUMP_SELECTOR);
        (bytes4 sel, bytes memory ctx) =
            hook.beforeExecute(DUMMY_KEY_HASH, TARGET, 0, data);
        assertEq(sel, BEFORE_EXECUTE);
        assertEq(ctx.length, 0);
    }

    function test_beforeExecute_reverts_unknown_selector() public {
        bytes memory data =
            abi.encodeWithSelector(TRANSFER_SELECTOR, address(0xbeef), 1 ether);
        vm.expectRevert(
            abi.encodeWithSelector(
                CaliburExecutionHook.CallNotAllowed.selector,
                TARGET,
                TRANSFER_SELECTOR
            )
        );
        hook.beforeExecute(DUMMY_KEY_HASH, TARGET, 0, data);
    }

    function test_beforeExecute_reverts_unknown_target() public {
        bytes memory data = abi.encodeWithSelector(BUMP_SELECTOR);
        vm.expectRevert(
            abi.encodeWithSelector(
                CaliburExecutionHook.CallNotAllowed.selector,
                address(0xdead),
                BUMP_SELECTOR
            )
        );
        hook.beforeExecute(DUMMY_KEY_HASH, address(0xdead), 0, data);
    }

    function test_beforeExecute_reverts_empty_calldata() public {
        bytes memory data = hex"";
        vm.expectRevert(CaliburExecutionHook.EmptyCallData.selector);
        hook.beforeExecute(DUMMY_KEY_HASH, TARGET, 0, data);
    }

    // ─── ERC20.approve permissive (any token, allowed spender) ─────────

    function test_beforeExecute_passes_erc20_approve_to_allowed_spender()
        public
        view
    {
        // arbitrary token target; only spender argument matters.
        bytes memory data = abi.encodeWithSelector(
            ERC20_APPROVE,
            ALLOWED_SPENDER,
            type(uint256).max
        );
        (bytes4 sel, ) =
            hook.beforeExecute(DUMMY_KEY_HASH, address(0xCAFE), 0, data);
        assertEq(sel, BEFORE_EXECUTE);
    }

    function test_beforeExecute_reverts_erc20_approve_to_denied_spender()
        public
    {
        bytes memory data = abi.encodeWithSelector(
            ERC20_APPROVE,
            DENIED_SPENDER,
            type(uint256).max
        );
        vm.expectRevert(
            abi.encodeWithSelector(
                CaliburExecutionHook.SpenderNotAllowed.selector,
                DENIED_SPENDER
            )
        );
        hook.beforeExecute(DUMMY_KEY_HASH, address(0xCAFE), 0, data);
    }

    function test_beforeExecute_reverts_erc20_approve_truncated() public {
        // missing the spender + amount tail
        bytes memory data = abi.encodePacked(ERC20_APPROVE, uint128(0));
        vm.expectRevert(
            abi.encodeWithSelector(
                CaliburExecutionHook.CallNotAllowed.selector,
                address(0xCAFE),
                ERC20_APPROVE
            )
        );
        hook.beforeExecute(DUMMY_KEY_HASH, address(0xCAFE), 0, data);
    }

    // ─── Permit2.approve(token, spender, amount, expiration) ───────────

    function test_beforeExecute_passes_permit2_approve_allowed_spender()
        public
        view
    {
        bytes memory data = abi.encodeWithSelector(
            PERMIT2_APPROVE,
            address(0x1111),
            ALLOWED_SPENDER,
            uint160(1_000_000),
            uint48(block.timestamp + 1 days)
        );
        (bytes4 sel, ) =
            hook.beforeExecute(DUMMY_KEY_HASH, address(0xBEEF), 0, data);
        assertEq(sel, BEFORE_EXECUTE);
    }

    function test_beforeExecute_reverts_permit2_approve_denied_spender()
        public
    {
        bytes memory data = abi.encodeWithSelector(
            PERMIT2_APPROVE,
            address(0x1111),
            DENIED_SPENDER,
            uint160(1_000_000),
            uint48(block.timestamp + 1 days)
        );
        vm.expectRevert(
            abi.encodeWithSelector(
                CaliburExecutionHook.SpenderNotAllowed.selector,
                DENIED_SPENDER
            )
        );
        hook.beforeExecute(DUMMY_KEY_HASH, address(0xBEEF), 0, data);
    }

    // ─── afterExecute is a no-op that returns the right selector ──────

    function test_afterExecute_returns_selector() public view {
        bytes4 sel =
            hook.afterExecute(DUMMY_KEY_HASH, true, hex"", hex"");
        assertEq(sel, AFTER_EXECUTE);
    }

    function test_afterExecute_does_not_revert_on_failure() public view {
        bytes4 sel =
            hook.afterExecute(DUMMY_KEY_HASH, false, hex"deadbeef", hex"");
        assertEq(sel, AFTER_EXECUTE);
    }

    // ─── Public read methods ──────────────────────────────────────────

    function test_allowed_returns_true_for_whitelisted() public view {
        assertTrue(hook.allowed(TARGET, BUMP_SELECTOR));
    }

    function test_allowed_returns_false_for_unknown() public view {
        assertFalse(hook.allowed(TARGET, TRANSFER_SELECTOR));
        assertFalse(hook.allowed(address(0xdead), BUMP_SELECTOR));
    }

    function test_isAllowedSpender_reads_correctly() public view {
        assertTrue(hook.isAllowedSpender(ALLOWED_SPENDER));
        assertFalse(hook.isAllowedSpender(DENIED_SPENDER));
    }
}
