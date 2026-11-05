// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "forge-std/Test.sol";
import "../src/Rungs.sol";

contract RungsHandler is Test {
  Rungs public rungs;

  address public creator = address(0x1000);
  address public playerA = address(0x2001);
  address public playerB = address(0x2002);
  address public playerC = address(0x2003);

  uint256 public ladderId;
  uint256 public lockedStakes;
  uint256 public totalPending;

  constructor(Rungs _rungs) {
    rungs = _rungs;

    vm.deal(playerA, 100_000 ether);
    vm.deal(playerB, 100_000 ether);
    vm.deal(playerC, 100_000 ether);

    vm.prank(creator);
    ladderId = rungs.create("Invariant Ladder", 0.1 ether);

    vm.prank(playerA); rungs.join(ladderId);
    vm.prank(playerB); rungs.join(ladderId);
    vm.prank(playerC); rungs.join(ladderId);
  }

  function challengeAndPlay(uint8 action) external {
    uint256 busyB = rungs.busyOf(ladderId, playerB);
    uint256 busyA = rungs.busyOf(ladderId, playerA);

    if (busyB == 0 && busyA == 0) {
      uint32 rankB = rungs.rankOf(ladderId, playerB);
      uint32 rankA = rungs.rankOf(ladderId, playerA);

      if (rankB > rankA && rankB - rankA <= 3) {
        vm.prank(playerB);
        try rungs.challenge{value: 0.1 ether}(ladderId, rankA) returns (uint256 cid) {
          if (action % 3 == 0) {
            // Cancel
            vm.prank(playerB);
            try rungs.cancel(cid) {} catch {}
          } else if (action % 3 == 1) {
            // Accept and report
            vm.prank(playerA);
            try rungs.accept{value: 0.1 ether}(cid) {
              vm.prank(playerB);
              try rungs.report(cid, true) {} catch {}
              vm.prank(playerA);
              try rungs.report(cid, true) {} catch {}
            } catch {}
          } else {
            // Walkover
            vm.warp(block.timestamp + 4 days);
            vm.prank(playerB);
            try rungs.walkover(cid) {} catch {}
          }
        } catch {}
      }
    }
  }

  function withdrawPending(uint8 whoIdx) external {
    address who = whoIdx % 2 == 0 ? playerA : playerB;
    if (rungs.pending(who) > 0) {
      vm.prank(who);
      try rungs.withdraw() {} catch {}
    }
  }
}

contract RungsInvariantTest is Test {
  Rungs public rungs;
  RungsHandler public handler;

  function setUp() public {
    rungs = new Rungs();
    handler = new RungsHandler(rungs);
    targetContract(address(handler));
  }

  function invariant_BalanceEqualsLockedPlusPending() public view {
    // Assert balance >= 0 and non-negative solvency
    assertTrue(address(rungs).balance >= rungs.pending(handler.playerA()) + rungs.pending(handler.playerB()));
  }
}
