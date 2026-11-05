// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "forge-std/Script.sol";
import "../src/Rungs.sol";

contract DeployScript is Script {
  function run() external returns (Rungs rungs) {
    vm.startBroadcast();
    rungs = new Rungs();
    vm.stopBroadcast();
  }
}
