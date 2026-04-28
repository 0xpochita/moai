// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {GuardedExecutorHook} from "../src/GuardedExecutorHook.sol";

/// @notice Deploys GuardedExecutorHook with the Base mainnet whitelist
/// covering the full out-of-range → vault migration flow.
/// Run with: forge script script/DeployHook.s.sol --rpc-url base --broadcast --verify
contract DeployHook is Script {
    address constant POSITION_MANAGER_V4 =
        0x7C5f5A4bbd8fD63184577525326123B519429bDc;
    address constant UNIVERSAL_ROUTER =
        0x6fF5693b99212Da76ad316178A184AB56D299b43;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant LIFI_DIAMOND =
        0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE;
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant USDT_BASE = 0xFdE4C96c8593536E31F229EA8f37b2ADa2699bb2;
    address constant DAI_BASE = 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb;

    bytes4 constant MODIFY_LIQUIDITIES_SELECTOR =
        bytes4(keccak256("modifyLiquidities(bytes,uint256)"));
    bytes4 constant UNIVERSAL_ROUTER_EXECUTE_SELECTOR =
        bytes4(keccak256("execute(bytes,bytes[],uint256)"));
    bytes4 constant PERMIT2_PERMIT_TRANSFER_FROM_SELECTOR =
        bytes4(
            keccak256(
                "permitTransferFrom((( address,uint256),uint256,uint256),(address,uint256),address,bytes)"
            )
        );
    bytes4 constant ERC20_APPROVE_SELECTOR =
        bytes4(keccak256("approve(address,uint256)"));
    bytes4 constant LIFI_SWAP_TOKENS_GENERIC_SELECTOR =
        bytes4(keccak256("swapTokensGeneric(bytes32,string,string,address,uint256,(address,address,address,uint256,bytes,bool)[])"));
    bytes4 constant LIFI_DEPOSIT_TO_SELECTOR =
        bytes4(keccak256("deposit(uint256,address)"));

    function run() external returns (GuardedExecutorHook hook) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        GuardedExecutorHook.WhitelistEntry[] memory entries =
            new GuardedExecutorHook.WhitelistEntry[](9);

        entries[0] = GuardedExecutorHook.WhitelistEntry({
            target: POSITION_MANAGER_V4,
            selector: MODIFY_LIQUIDITIES_SELECTOR
        });
        entries[1] = GuardedExecutorHook.WhitelistEntry({
            target: UNIVERSAL_ROUTER,
            selector: UNIVERSAL_ROUTER_EXECUTE_SELECTOR
        });
        entries[2] = GuardedExecutorHook.WhitelistEntry({
            target: PERMIT2,
            selector: PERMIT2_PERMIT_TRANSFER_FROM_SELECTOR
        });
        // Allow ERC20 approve only when targeting Permit2 or Li.Fi
        entries[3] = GuardedExecutorHook.WhitelistEntry({
            target: USDC_BASE,
            selector: ERC20_APPROVE_SELECTOR
        });
        entries[4] = GuardedExecutorHook.WhitelistEntry({
            target: USDT_BASE,
            selector: ERC20_APPROVE_SELECTOR
        });
        entries[5] = GuardedExecutorHook.WhitelistEntry({
            target: DAI_BASE,
            selector: ERC20_APPROVE_SELECTOR
        });
        // Li.Fi Composer entrypoints used during deposit/withdraw
        entries[6] = GuardedExecutorHook.WhitelistEntry({
            target: LIFI_DIAMOND,
            selector: LIFI_SWAP_TOKENS_GENERIC_SELECTOR
        });
        entries[7] = GuardedExecutorHook.WhitelistEntry({
            target: LIFI_DIAMOND,
            selector: LIFI_DEPOSIT_TO_SELECTOR
        });
        // Position approve on the v4 PositionManager (in case of permit-style calls)
        entries[8] = GuardedExecutorHook.WhitelistEntry({
            target: POSITION_MANAGER_V4,
            selector: ERC20_APPROVE_SELECTOR
        });

        hook = new GuardedExecutorHook(entries);

        vm.stopBroadcast();

        console.log("GuardedExecutorHook deployed at:", address(hook));
    }
}
