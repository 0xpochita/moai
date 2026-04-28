// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GuardedExecutorHook} from "../src/GuardedExecutorHook.sol";

contract MockTarget {
    uint256 public counter;

    function bump() external {
        counter += 1;
    }

    function transfer(address, uint256) external pure returns (bool) {
        return true;
    }
}

contract GuardedExecutorHookTest is Test {
    GuardedExecutorHook hook;
    MockTarget target;

    address constant ALLOWED_SPENDER = address(0xC0FFEE);
    address constant DENIED_SPENDER = address(0xBAD);

    bytes4 constant BUMP_SELECTOR = bytes4(keccak256("bump()"));
    bytes4 constant TRANSFER_SELECTOR =
        bytes4(keccak256("transfer(address,uint256)"));
    bytes4 constant ERC20_APPROVE = 0x095ea7b3;
    bytes4 constant PERMIT2_APPROVE = 0x87517c45;

    function setUp() public {
        target = new MockTarget();

        GuardedExecutorHook.WhitelistEntry[] memory entries =
            new GuardedExecutorHook.WhitelistEntry[](1);
        entries[0] = GuardedExecutorHook.WhitelistEntry({
            target: address(target),
            selector: BUMP_SELECTOR
        });

        address[] memory spenders = new address[](1);
        spenders[0] = ALLOWED_SPENDER;

        hook = new GuardedExecutorHook(entries, spenders);
    }

    function test_allowed_returns_true_for_whitelisted() public view {
        assertTrue(hook.allowed(address(target), BUMP_SELECTOR));
    }

    function test_allowed_returns_false_for_unknown() public view {
        assertFalse(hook.allowed(address(target), TRANSFER_SELECTOR));
        assertFalse(hook.allowed(address(0xdead), BUMP_SELECTOR));
    }

    function test_validate_passes_for_whitelisted_call() public view {
        GuardedExecutorHook.Call[] memory calls =
            new GuardedExecutorHook.Call[](1);
        calls[0] = GuardedExecutorHook.Call({
            target: address(target),
            value: 0,
            data: abi.encodeWithSelector(BUMP_SELECTOR)
        });
        hook.validate(calls);
    }

    function test_validate_reverts_for_disallowed_selector() public {
        GuardedExecutorHook.Call[] memory calls =
            new GuardedExecutorHook.Call[](1);
        calls[0] = GuardedExecutorHook.Call({
            target: address(target),
            value: 0,
            data: abi.encodeWithSelector(TRANSFER_SELECTOR, address(0xbeef), 1 ether)
        });
        vm.expectRevert(
            abi.encodeWithSelector(
                GuardedExecutorHook.CallNotAllowed.selector,
                address(target),
                TRANSFER_SELECTOR
            )
        );
        hook.validate(calls);
    }

    function test_validate_reverts_for_unknown_target() public {
        GuardedExecutorHook.Call[] memory calls =
            new GuardedExecutorHook.Call[](1);
        calls[0] = GuardedExecutorHook.Call({
            target: address(0xdead),
            value: 0,
            data: abi.encodeWithSelector(BUMP_SELECTOR)
        });
        vm.expectRevert(
            abi.encodeWithSelector(
                GuardedExecutorHook.CallNotAllowed.selector,
                address(0xdead),
                BUMP_SELECTOR
            )
        );
        hook.validate(calls);
    }

    function test_validate_reverts_on_empty_calldata() public {
        GuardedExecutorHook.Call[] memory calls =
            new GuardedExecutorHook.Call[](1);
        calls[0] = GuardedExecutorHook.Call({
            target: address(target),
            value: 0,
            data: hex""
        });
        vm.expectRevert(
            abi.encodeWithSelector(GuardedExecutorHook.EmptyCallData.selector, 0)
        );
        hook.validate(calls);
    }

    // ─── ERC20.approve permissive (any token) ──────────────────────────

    function test_validate_passes_erc20_approve_to_allowed_spender() public view {
        GuardedExecutorHook.Call[] memory calls =
            new GuardedExecutorHook.Call[](1);
        // Note: target is an arbitrary address (any token); only spender matters.
        calls[0] = GuardedExecutorHook.Call({
            target: address(0xCAFE),
            value: 0,
            data: abi.encodeWithSelector(ERC20_APPROVE, ALLOWED_SPENDER, type(uint256).max)
        });
        hook.validate(calls);
    }

    function test_validate_reverts_erc20_approve_to_denied_spender() public {
        GuardedExecutorHook.Call[] memory calls =
            new GuardedExecutorHook.Call[](1);
        calls[0] = GuardedExecutorHook.Call({
            target: address(0xCAFE),
            value: 0,
            data: abi.encodeWithSelector(ERC20_APPROVE, DENIED_SPENDER, type(uint256).max)
        });
        vm.expectRevert(
            abi.encodeWithSelector(
                GuardedExecutorHook.SpenderNotAllowed.selector,
                DENIED_SPENDER
            )
        );
        hook.validate(calls);
    }

    function test_validate_reverts_erc20_approve_truncated_calldata() public {
        GuardedExecutorHook.Call[] memory calls =
            new GuardedExecutorHook.Call[](1);
        calls[0] = GuardedExecutorHook.Call({
            target: address(0xCAFE),
            value: 0,
            data: abi.encodePacked(ERC20_APPROVE, uint128(0)) // too short
        });
        vm.expectRevert(
            abi.encodeWithSelector(
                GuardedExecutorHook.CallNotAllowed.selector,
                address(0xCAFE),
                ERC20_APPROVE
            )
        );
        hook.validate(calls);
    }

    // ─── Permit2.approve(token, spender, amount, expiration) ───────────

    function test_validate_passes_permit2_approve_to_allowed_spender() public view {
        GuardedExecutorHook.Call[] memory calls =
            new GuardedExecutorHook.Call[](1);
        calls[0] = GuardedExecutorHook.Call({
            target: address(0xBEEF),
            value: 0,
            data: abi.encodeWithSelector(
                PERMIT2_APPROVE,
                address(0x1111),
                ALLOWED_SPENDER,
                uint160(1_000_000),
                uint48(block.timestamp + 1 days)
            )
        });
        hook.validate(calls);
    }

    function test_validate_reverts_permit2_approve_to_denied_spender() public {
        GuardedExecutorHook.Call[] memory calls =
            new GuardedExecutorHook.Call[](1);
        calls[0] = GuardedExecutorHook.Call({
            target: address(0xBEEF),
            value: 0,
            data: abi.encodeWithSelector(
                PERMIT2_APPROVE,
                address(0x1111),
                DENIED_SPENDER,
                uint160(1_000_000),
                uint48(block.timestamp + 1 days)
            )
        });
        vm.expectRevert(
            abi.encodeWithSelector(
                GuardedExecutorHook.SpenderNotAllowed.selector,
                DENIED_SPENDER
            )
        );
        hook.validate(calls);
    }

    // ─── Execute path ──────────────────────────────────────────────────

    function test_execute_runs_whitelisted_call() public {
        GuardedExecutorHook.Call[] memory calls =
            new GuardedExecutorHook.Call[](2);
        calls[0] = GuardedExecutorHook.Call({
            target: address(target),
            value: 0,
            data: abi.encodeWithSelector(BUMP_SELECTOR)
        });
        calls[1] = GuardedExecutorHook.Call({
            target: address(target),
            value: 0,
            data: abi.encodeWithSelector(BUMP_SELECTOR)
        });
        hook.execute(calls);
        assertEq(target.counter(), 2);
    }

    function test_execute_reverts_on_disallowed_call_in_batch() public {
        GuardedExecutorHook.Call[] memory calls =
            new GuardedExecutorHook.Call[](2);
        calls[0] = GuardedExecutorHook.Call({
            target: address(target),
            value: 0,
            data: abi.encodeWithSelector(BUMP_SELECTOR)
        });
        calls[1] = GuardedExecutorHook.Call({
            target: address(target),
            value: 0,
            data: abi.encodeWithSelector(TRANSFER_SELECTOR, address(0xbeef), 1)
        });
        vm.expectRevert();
        hook.execute(calls);
        assertEq(target.counter(), 0);
    }
}
