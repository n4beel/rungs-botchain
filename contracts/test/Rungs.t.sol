// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "forge-std/Test.sol";
import "../src/Rungs.sol";

contract MaliciousRecipient {
  Rungs public rungs;
  bool public attackWithdraw;

  constructor(Rungs _rungs) {
    rungs = _rungs;
  }

  function setAttackWithdraw(bool b) external {
    attackWithdraw = b;
  }

  function triggerWithdraw() external {
    rungs.withdraw();
  }

  receive() external payable {
    if (attackWithdraw) {
      attackWithdraw = false;
      rungs.withdraw();
    }
  }
}

contract RungsTest is Test {
  Rungs public rungs;

  address public creator = address(0x1000);
  address public playerA = address(0x2001);
  address public playerB = address(0x2002);
  address public playerC = address(0x2003);
  address public playerD = address(0x2004);
  address public playerE = address(0x2005);

  uint128 public constant STAKE = 0.1 ether;

  function setUp() public {
    rungs = new Rungs();

    vm.deal(playerA, 100 ether);
    vm.deal(playerB, 100 ether);
    vm.deal(playerC, 100 ether);
    vm.deal(playerD, 100 ether);
    vm.deal(playerE, 100 ether);
  }

  function _createLadder() internal returns (uint256) {
    vm.prank(creator);
    return rungs.create("Club Ladder", STAKE);
  }

  function test_CreateAndJoinOrdersByArrival() public {
    uint256 lid = _createLadder();

    vm.prank(playerA);
    rungs.join(lid);
    vm.prank(playerB);
    rungs.join(lid);
    vm.prank(playerC);
    rungs.join(lid);

    assertEq(rungs.rankOf(lid, playerA), 1);
    assertEq(rungs.rankOf(lid, playerB), 2);
    assertEq(rungs.rankOf(lid, playerC), 3);

    address[] memory list = rungs.standings(lid, 0, 10);
    assertEq(list.length, 3);
    assertEq(list[0], playerA);
    assertEq(list[1], playerB);
    assertEq(list[2], playerC);
  }

  function test_ChallengeWithinThreeRungs() public {
    uint256 lid = _createLadder();
    vm.prank(playerA); rungs.join(lid);
    vm.prank(playerB); rungs.join(lid);
    vm.prank(playerC); rungs.join(lid);
    vm.prank(playerD); rungs.join(lid);

    // Player D (rank 4) challenges Player A (rank 1): 4 - 1 = 3 <= 3
    vm.prank(playerD);
    uint256 cid = rungs.challenge{value: STAKE}(lid, 1);
    assertEq(cid, 1);

    Rungs.Challenge memory c = rungs.challengeOf(cid);
    assertEq(c.challenger, playerD);
    assertEq(c.target, playerA);
    assertEq(uint8(c.state), uint8(Rungs.State.Offered));

    assertEq(rungs.busyOf(lid, playerD), cid);
    assertEq(rungs.busyOf(lid, playerA), cid);
  }

  function test_ChallengeTooFarReverts_ArgsMaxRank() public {
    uint256 lid = _createLadder();
    vm.prank(playerA); rungs.join(lid);
    vm.prank(playerB); rungs.join(lid);
    vm.prank(playerC); rungs.join(lid);
    vm.prank(playerD); rungs.join(lid);
    vm.prank(playerE); rungs.join(lid);

    // Player E (rank 5) attempts to challenge Player A (rank 1): 5 - 1 = 4 > 3
    vm.prank(playerE);
    vm.expectRevert(abi.encodeWithSelector(Rungs.OutOfReach.selector, 2));
    rungs.challenge{value: STAKE}(lid, 1);
  }

  function test_ChallengeSelfOrAboveSelfReverts() public {
    uint256 lid = _createLadder();
    vm.prank(playerA); rungs.join(lid);
    vm.prank(playerB); rungs.join(lid);

    // Player B (rank 2) challenges rank 2 or 3
    vm.prank(playerB);
    vm.expectRevert(abi.encodeWithSelector(Rungs.OutOfReach.selector, 1));
    rungs.challenge{value: STAKE}(lid, 2);
  }

  function test_BusyBlocksSecondChallenge() public {
    uint256 lid = _createLadder();
    vm.prank(playerA); rungs.join(lid);
    vm.prank(playerB); rungs.join(lid);
    vm.prank(playerC); rungs.join(lid);

    vm.prank(playerC);
    rungs.challenge{value: STAKE}(lid, 2);

    // Player C attempts another challenge
    vm.prank(playerC);
    vm.expectRevert(Rungs.Busy.selector);
    rungs.challenge{value: STAKE}(lid, 1);
  }

  function test_TargetBusyReverts() public {
    uint256 lid = _createLadder();
    vm.prank(playerA); rungs.join(lid);
    vm.prank(playerB); rungs.join(lid);
    vm.prank(playerC); rungs.join(lid);
    vm.prank(playerD); rungs.join(lid);

    // B challenges A
    vm.prank(playerB);
    rungs.challenge{value: STAKE}(lid, 1);

    // C tries to challenge A (who is busy)
    vm.prank(playerC);
    vm.expectRevert(Rungs.TargetBusy.selector);
    rungs.challenge{value: STAKE}(lid, 1);
  }

  function test_AcceptMatchesStake() public {
    uint256 lid = _createLadder();
    vm.prank(playerA); rungs.join(lid);
    vm.prank(playerB); rungs.join(lid);

    vm.prank(playerB);
    uint256 cid = rungs.challenge{value: STAKE}(lid, 1);

    // Non-target tries to accept
    vm.prank(playerC);
    vm.expectRevert(Rungs.NotTarget.selector);
    rungs.accept{value: STAKE}(cid);

    // Target accepts with wrong value
    vm.prank(playerA);
    vm.expectRevert(abi.encodeWithSelector(Rungs.WrongPayment.selector, STAKE));
    rungs.accept{value: STAKE / 2}(cid);

    // Target accepts correctly
    vm.prank(playerA);
    rungs.accept{value: STAKE}(cid);

    Rungs.Challenge memory c = rungs.challengeOf(cid);
    assertEq(uint8(c.state), uint8(Rungs.State.Active));
    assertEq(c.reportBy, block.timestamp + 7 days);
  }

  function test_AcceptAfterWindowReverts() public {
    uint256 lid = _createLadder();
    vm.prank(playerA); rungs.join(lid);
    vm.prank(playerB); rungs.join(lid);

    vm.prank(playerB);
    uint256 cid = rungs.challenge{value: STAKE}(lid, 1);

    vm.warp(block.timestamp + 3 days + 1);

    vm.prank(playerA);
    vm.expectRevert(Rungs.TooLate.selector);
    rungs.accept{value: STAKE}(cid);
  }

  function test_CancelBeforeAcceptRefunds() public {
    uint256 lid = _createLadder();
    vm.prank(playerA); rungs.join(lid);
    vm.prank(playerB); rungs.join(lid);

    vm.prank(playerB);
    uint256 cid = rungs.challenge{value: STAKE}(lid, 1);

    uint256 balBefore = playerB.balance;
    vm.prank(playerB);
    rungs.cancel(cid);
    uint256 balAfter = playerB.balance;

    assertEq(balAfter - balBefore, STAKE);
    assertEq(rungs.busyOf(lid, playerA), 0);
    assertEq(rungs.busyOf(lid, playerB), 0);
  }

  function test_WalkoverAfterWindowSwapsAndRefunds() public {
    uint256 lid = _createLadder();
    vm.prank(playerA); rungs.join(lid);
    vm.prank(playerB); rungs.join(lid);

    vm.prank(playerB);
    uint256 cid = rungs.challenge{value: STAKE}(lid, 1);

    vm.warp(block.timestamp + 3 days + 1);

    uint256 balBefore = playerB.balance;
    vm.prank(playerB);
    rungs.walkover(cid);
    uint256 balAfter = playerB.balance;

    assertEq(balAfter - balBefore, STAKE);
    // B and A swapped ranks!
    assertEq(rungs.rankOf(lid, playerB), 1);
    assertEq(rungs.rankOf(lid, playerA), 2);
  }

  function test_WalkoverBeforeWindowReverts_ArgsAcceptBy() public {
    uint256 lid = _createLadder();
    vm.prank(playerA); rungs.join(lid);
    vm.prank(playerB); rungs.join(lid);

    vm.prank(playerB);
    uint256 cid = rungs.challenge{value: STAKE}(lid, 1);
    uint64 acceptBy = uint64(block.timestamp + 3 days);

    vm.prank(playerB);
    vm.expectRevert(abi.encodeWithSelector(Rungs.NotYet.selector, acceptBy));
    rungs.walkover(cid);
  }

  function test_BothReportChallengerWonSwapsAndPays() public {
    uint256 lid = _createLadder();
    vm.prank(playerA); rungs.join(lid);
    vm.prank(playerB); rungs.join(lid);

    vm.prank(playerB);
    uint256 cid = rungs.challenge{value: STAKE}(lid, 1);

    vm.prank(playerA);
    rungs.accept{value: STAKE}(cid);

    // Both report challenger (B) won
    vm.prank(playerB);
    rungs.report(cid, true);
    vm.prank(playerA);
    rungs.report(cid, true);

    Rungs.Challenge memory c = rungs.challengeOf(cid);
    assertEq(uint8(c.state), uint8(Rungs.State.Settled));

    // B swapped to rank 1, A dropped to rank 2
    assertEq(rungs.rankOf(lid, playerB), 1);
    assertEq(rungs.rankOf(lid, playerA), 2);

    // Winner B credited 2 * STAKE in pending
    assertEq(rungs.pending(playerB), STAKE * 2);
  }

  function test_BothReportTargetWonKeepsRanks() public {
    uint256 lid = _createLadder();
    vm.prank(playerA); rungs.join(lid);
    vm.prank(playerB); rungs.join(lid);

    vm.prank(playerB);
    uint256 cid = rungs.challenge{value: STAKE}(lid, 1);

    vm.prank(playerA);
    rungs.accept{value: STAKE}(cid);

    // Both report target (A) won
    vm.prank(playerB);
    rungs.report(cid, false);
    vm.prank(playerA);
    rungs.report(cid, false);

    Rungs.Challenge memory c = rungs.challengeOf(cid);
    assertEq(uint8(c.state), uint8(Rungs.State.Settled));

    // Ranks unchanged
    assertEq(rungs.rankOf(lid, playerA), 1);
    assertEq(rungs.rankOf(lid, playerB), 2);

    // Winner A credited 2 * STAKE in pending
    assertEq(rungs.pending(playerA), STAKE * 2);
  }

  function test_DisagreeVoidsAndRefundsBoth() public {
    uint256 lid = _createLadder();
    vm.prank(playerA); rungs.join(lid);
    vm.prank(playerB); rungs.join(lid);

    vm.prank(playerB);
    uint256 cid = rungs.challenge{value: STAKE}(lid, 1);

    vm.prank(playerA);
    rungs.accept{value: STAKE}(cid);

    // B claims B won, A claims A won
    vm.prank(playerB);
    rungs.report(cid, true);
    vm.prank(playerA);
    rungs.report(cid, false);

    Rungs.Challenge memory c = rungs.challengeOf(cid);
    assertEq(uint8(c.state), uint8(Rungs.State.Void));

    assertEq(rungs.pending(playerA), STAKE);
    assertEq(rungs.pending(playerB), STAKE);
    assertEq(rungs.busyOf(lid, playerA), 0);
    assertEq(rungs.busyOf(lid, playerB), 0);
  }

  function test_OneReportOnlyThenVoidAfterWindow() public {
    uint256 lid = _createLadder();
    vm.prank(playerA); rungs.join(lid);
    vm.prank(playerB); rungs.join(lid);

    vm.prank(playerB);
    uint256 cid = rungs.challenge{value: STAKE}(lid, 1);
    vm.prank(playerA);
    rungs.accept{value: STAKE}(cid);

    vm.prank(playerB);
    rungs.report(cid, true);

    vm.warp(block.timestamp + 7 days + 1);

    rungs.voidChallenge(cid);

    Rungs.Challenge memory c = rungs.challengeOf(cid);
    assertEq(uint8(c.state), uint8(Rungs.State.Void));
    assertEq(rungs.pending(playerA), STAKE);
    assertEq(rungs.pending(playerB), STAKE);
  }

  function test_SwapUsesCurrentRanks() public {
    uint256 lid = _createLadder();
    vm.prank(playerA); rungs.join(lid); // 1
    vm.prank(playerB); rungs.join(lid); // 2
    vm.prank(playerC); rungs.join(lid); // 3

    // C challenges B
    vm.prank(playerC);
    uint256 cidCB = rungs.challenge{value: STAKE}(lid, 2);
    vm.prank(playerB);
    rungs.accept{value: STAKE}(cidCB);

    // Settle CB: C wins and swaps with B -> C is now 2, B is now 3
    vm.prank(playerC);
    rungs.report(cidCB, true);
    vm.prank(playerB);
    rungs.report(cidCB, true);

    assertEq(rungs.rankOf(lid, playerC), 2);
    assertEq(rungs.rankOf(lid, playerB), 3);

    // Now C challenges A
    vm.prank(playerC);
    uint256 cidCA = rungs.challenge{value: STAKE}(lid, 1);
    vm.prank(playerA);
    rungs.accept{value: STAKE}(cidCA);

    vm.prank(playerC);
    rungs.report(cidCA, true);
    vm.prank(playerA);
    rungs.report(cidCA, true);

    assertEq(rungs.rankOf(lid, playerC), 1);
    assertEq(rungs.rankOf(lid, playerA), 2);
    assertEq(rungs.rankOf(lid, playerB), 3);
  }

  function test_FullLadderRejectsJoin() public {
    uint256 lid = _createLadder();
    for (uint160 i = 1; i <= 50; i++) {
      address p = address(0x5000 + i);
      vm.prank(p);
      rungs.join(lid);
    }

    vm.prank(address(0x9999));
    vm.expectRevert(Rungs.LadderFull.selector);
    rungs.join(lid);
  }

  function test_ReentrantWithdrawBlocked() public {
    MaliciousRecipient attacker = new MaliciousRecipient(rungs);
    vm.deal(address(attacker), 10 ether);

    uint256 lid = _createLadder();
    vm.prank(address(attacker));
    rungs.join(lid);
    vm.prank(playerA);
    rungs.join(lid);

    // Player A challenges Attacker
    vm.prank(playerA);
    uint256 cid = rungs.challenge{value: STAKE}(lid, 1);
    vm.prank(address(attacker));
    rungs.accept{value: STAKE}(cid);

    // Both report attacker won
    vm.prank(playerA);
    rungs.report(cid, false);
    vm.prank(address(attacker));
    rungs.report(cid, false);

    attacker.setAttackWithdraw(true);
    vm.expectRevert(Rungs.TransferFailed.selector);
    attacker.triggerWithdraw();
  }

  function testFuzz_RanksStayAPermutation(uint8 seed) public {
    uint256 lid = _createLadder();
    address[4] memory players = [playerA, playerB, playerC, playerD];
    for (uint256 i = 0; i < 4; i++) {
      vm.prank(players[i]);
      rungs.join(lid);
    }

    // Play a sequence of challenges
    if (seed % 2 == 0) {
      vm.prank(playerB);
      uint256 cid = rungs.challenge{value: STAKE}(lid, 1);
      vm.prank(playerA);
      rungs.accept{value: STAKE}(cid);
      vm.prank(playerB);
      rungs.report(cid, true);
      vm.prank(playerA);
      rungs.report(cid, true);
    } else {
      vm.prank(playerC);
      uint256 cid = rungs.challenge{value: STAKE}(lid, 2);
      vm.warp(block.timestamp + 4 days);
      vm.prank(playerC);
      rungs.walkover(cid);
    }

    // Assert permutation: each rank 1..4 is occupied by a unique player
    bool[5] memory seen;
    for (uint256 i = 0; i < 4; i++) {
      uint32 r = rungs.rankOf(lid, players[i]);
      assertTrue(r >= 1 && r <= 4);
      assertFalse(seen[r]);
      seen[r] = true;
    }
  }

  function test_SpecificMutantKillers() public {
    // MAX_MEMBERS = 50 boundary check
    assertEq(rungs.MAX_MEMBERS(), 50);
    assertEq(rungs.MAX_JUMP(), 3);
    assertEq(rungs.ACCEPT_WINDOW(), 3 days);
    assertEq(rungs.REPORT_WINDOW(), 7 days);

    // 1. Min / Max stake boundary
    vm.prank(creator);
    rungs.create("Min Stake Ladder", 0.01 ether);
    vm.prank(creator);
    rungs.create("Max Stake Ladder", 1000 ether);
    vm.expectRevert(Rungs.BadParams.selector);
    vm.prank(creator);
    rungs.create("Above Max Stake Ladder", 1000 ether + 1);

    // 2. Exact acceptBy timestamp check (block.timestamp <= acceptBy should revert on walkover)
    uint256 lid = _createLadder();
    vm.prank(playerA);
    rungs.join(lid);
    vm.prank(playerB);
    rungs.join(lid);
    vm.prank(playerB);
    uint256 cid = rungs.challenge{value: STAKE}(lid, 1);
    Rungs.Challenge memory c = rungs.challengeOf(cid);
    vm.warp(c.acceptBy);
    vm.prank(playerB);
    vm.expectRevert(abi.encodeWithSelector(Rungs.NotYet.selector, c.acceptBy));
    rungs.walkover(cid);

    // 3. Exact reportBy boundary for reporting (block.timestamp == reportBy must succeed)
    vm.warp(c.acceptBy - 1 hours);
    vm.prank(playerA);
    rungs.accept{value: STAKE}(cid);
    c = rungs.challengeOf(cid);
    vm.warp(c.reportBy);
    vm.prank(playerB);
    rungs.report(cid, true); // at exact reportBy, reporting is still allowed

    // 4. Settled event swapped flag check when challenger wins
    vm.expectEmit(true, true, true, true);
    emit Rungs.Settled(cid, playerB, true);
    vm.prank(playerA);
    rungs.report(cid, true);

    // 5. Standings & latest pagination bounds
    address[] memory st = rungs.standings(lid, 1, 10);
    assertEq(st.length, 1);
    (uint256[] memory ids, Rungs.Ladder[] memory list) = rungs.latest(1, 10);
    assertGt(ids.length, 0);
    assertEq(list.length, ids.length);
    assertEq(ids[0], 2); // order check
  }
}
