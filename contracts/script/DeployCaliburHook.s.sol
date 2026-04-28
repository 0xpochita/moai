// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {CaliburExecutionHook} from "../src/CaliburExecutionHook.sol";

/// @notice Deploys CaliburExecutionHook with the Base mainnet whitelist
/// covering the full out-of-range -> vault migration flow. Plugs into the
/// Calibur smart-wallet singleton's per-key hook slot.
/// Run with:
///   forge script script/DeployCaliburHook.s.sol --rpc-url base --broadcast --verify
contract DeployCaliburHook is Script {
    address constant POSITION_MANAGER_V4 =
        0x7C5f5A4bBd8fD63184577525326123B519429bDc;
    address constant UNIVERSAL_ROUTER =
        0x6fF5693b99212Da76ad316178A184AB56D299b43;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant LIFI_DIAMOND =
        0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE;

    bytes4 constant MODIFY_LIQUIDITIES_SELECTOR =
        bytes4(keccak256("modifyLiquidities(bytes,uint256)"));
    bytes4 constant UNIVERSAL_ROUTER_EXECUTE_DEADLINE_SELECTOR =
        bytes4(keccak256("execute(bytes,bytes[],uint256)"));
    bytes4 constant UNIVERSAL_ROUTER_EXECUTE_NO_DEADLINE_SELECTOR =
        bytes4(keccak256("execute(bytes,bytes[])"));
    bytes4 constant PERMIT2_PERMIT_TRANSFER_FROM_SELECTOR =
        bytes4(
            keccak256(
                "permitTransferFrom((( address,uint256),uint256,uint256),(address,uint256),address,bytes)"
            )
        );
    bytes4 constant LIFI_SWAP_TOKENS_GENERIC_SELECTOR =
        bytes4(
            keccak256(
                "swapTokensGeneric(bytes32,string,string,address,uint256,(address,address,address,uint256,bytes,bool)[])"
            )
        );
    bytes4 constant LIFI_DEPOSIT_TO_SELECTOR =
        bytes4(keccak256("deposit(uint256,address)"));

    function run() external returns (CaliburExecutionHook hook) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        // (target, selector) whitelist — routine protocol calls.
        CaliburExecutionHook.WhitelistEntry[] memory entries =
            new CaliburExecutionHook.WhitelistEntry[](6);

        entries[0] = CaliburExecutionHook.WhitelistEntry({
            target: POSITION_MANAGER_V4,
            selector: MODIFY_LIQUIDITIES_SELECTOR
        });
        entries[1] = CaliburExecutionHook.WhitelistEntry({
            target: UNIVERSAL_ROUTER,
            selector: UNIVERSAL_ROUTER_EXECUTE_DEADLINE_SELECTOR
        });
        entries[2] = CaliburExecutionHook.WhitelistEntry({
            target: UNIVERSAL_ROUTER,
            selector: UNIVERSAL_ROUTER_EXECUTE_NO_DEADLINE_SELECTOR
        });
        entries[3] = CaliburExecutionHook.WhitelistEntry({
            target: PERMIT2,
            selector: PERMIT2_PERMIT_TRANSFER_FROM_SELECTOR
        });
        entries[4] = CaliburExecutionHook.WhitelistEntry({
            target: LIFI_DIAMOND,
            selector: LIFI_SWAP_TOKENS_GENERIC_SELECTOR
        });
        entries[5] = CaliburExecutionHook.WhitelistEntry({
            target: LIFI_DIAMOND,
            selector: LIFI_DEPOSIT_TO_SELECTOR
        });

        // Spender allow-list — every ERC20.approve and Permit2.approve call
        // must target one of these. Lets the agent migrate any token without
        // the Hook needing each token pre-listed, while preventing approvals
        // to attacker-controlled spenders.
        address[] memory allowedSpenders = new address[](3);
        allowedSpenders[0] = PERMIT2;
        allowedSpenders[1] = UNIVERSAL_ROUTER;
        allowedSpenders[2] = LIFI_DIAMOND;

        hook = new CaliburExecutionHook(entries, allowedSpenders);

        vm.stopBroadcast();

        console.log("CaliburExecutionHook deployed at:", address(hook));
    }
}
