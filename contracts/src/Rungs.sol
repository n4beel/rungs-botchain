// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

/**
 * @title Rungs
 * @notice Challenge ladder with stakes, walkover, and dual-reporting verification.
 */
contract Rungs {
  // --- Constants ---
  uint8 public constant MAX_NAME_BYTES = 48;
  uint32 public constant MAX_MEMBERS = 50;
  uint32 public constant MAX_JUMP = 3;
  uint128 public constant MIN_STAKE = 0.01 ether;
  uint128 public constant MAX_STAKE = 1000 ether;
  uint64 public constant ACCEPT_WINDOW = 3 days;
  uint64 public constant REPORT_WINDOW = 7 days;
  uint256 public constant MAX_PAGE = 50;

  enum State {
    Offered,
    Active,
    Settled,
    Void,
    Walkover,
    Cancelled
  }

  struct Ladder {
    address creator;
    uint32 count;
    uint128 stake;
    string name;
  }

  struct Challenge {
    uint256 ladderId;
    address challenger;
    address target;
    uint64 acceptBy;
    uint64 reportBy;
    uint128 stake;
    State state;
    uint8 reportC; // 0 none, 1 challenger won, 2 target won
    uint8 reportT;
  }

  // --- Storage ---
  mapping(uint256 => Ladder) private _ladders;
  mapping(uint256 => mapping(uint32 => address)) private _at; // ladderId => rank => player
  mapping(uint256 => mapping(address => uint32)) private _rank; // ladderId => player => rank (0 = not a member)
  mapping(uint256 => mapping(address => uint256)) private _busy; // ladderId => player => cid (0 = free)
  mapping(uint256 => Challenge) private _challenges;
  mapping(address => uint256) public pending;

  uint256 public ladderCount;
  uint256 public challengeCount;

  bool private _locked;

  // --- Custom Errors ---
  error BadParams();
  error NoSuchLadder();
  error NoSuchChallenge();
  error AlreadyMember();
  error LadderFull();
  error NotMember();
  error Busy();
  error OutOfReach(uint32 maxRank);
  error TargetBusy();
  error WrongPayment(uint256 expected);
  error NotTarget();
  error NotChallenger();
  error NotAPlayer();
  error WrongState();
  error TooLate();
  error NotYet(uint64 acceptBy);
  error ReportClosed();
  error AlreadyReported();
  error StillOpen(uint64 reportBy);
  error NothingToWithdraw();
  error TransferFailed();
  error ReentrantCall();

  // --- Events ---
  event Created(uint256 indexed id, address indexed creator, string name, uint128 stake);
  event Joined(uint256 indexed id, address indexed who, uint32 rank);
  event Challenged(
    uint256 indexed cid,
    uint256 indexed ladderId,
    address indexed challenger,
    address target,
    uint64 acceptBy
  );
  event Accepted(uint256 indexed cid, uint64 reportBy);
  event Cancelled(uint256 indexed cid);
  event WalkedOver(uint256 indexed cid, address indexed challenger, address indexed target);
  event Reported(uint256 indexed cid, address indexed who, uint8 report);
  event Settled(uint256 indexed cid, address indexed winner, bool swapped);
  event Voided(uint256 indexed cid, string reason);
  event Withdrawn(address indexed to, uint256 amount);

  modifier nonReentrant() {
    if (_locked) revert ReentrantCall();
    _locked = true;
    _;
    _locked = false;
  }

  // --- External Methods ---

  function create(string calldata name, uint128 stake) external returns (uint256 id) {
    bytes calldata nameBytes = bytes(name);
    if (nameBytes.length == 0 || nameBytes.length > MAX_NAME_BYTES) revert BadParams();
    if (stake < MIN_STAKE || stake > MAX_STAKE) revert BadParams();

    id = ++ladderCount;
    _ladders[id] = Ladder({
      creator: msg.sender,
      count: 0,
      stake: stake,
      name: name
    });

    emit Created(id, msg.sender, name, stake);
  }

  function join(uint256 id) external {
    if (id == 0 || id > ladderCount) revert NoSuchLadder();
    Ladder storage lad = _ladders[id];

    if (_rank[id][msg.sender] != 0) revert AlreadyMember();
    if (lad.count >= MAX_MEMBERS) revert LadderFull();

    uint32 newRank = ++lad.count;
    _at[id][newRank] = msg.sender;
    _rank[id][msg.sender] = newRank;

    emit Joined(id, msg.sender, newRank);
  }

  function challenge(uint256 id, uint32 targetRank) external payable returns (uint256 cid) {
    if (id == 0 || id > ladderCount) revert NoSuchLadder();
    Ladder storage lad = _ladders[id];

    uint32 myRank = _rank[id][msg.sender];
    if (myRank == 0) revert NotMember();
    if (_busy[id][msg.sender] != 0) revert Busy();

    if (targetRank == 0 || targetRank >= myRank) {
      uint32 minAllowed = myRank > MAX_JUMP ? myRank - MAX_JUMP : 1;
      revert OutOfReach(minAllowed);
    }
    if (myRank - targetRank > MAX_JUMP) {
      uint32 minAllowed = myRank - MAX_JUMP;
      revert OutOfReach(minAllowed);
    }

    address target = _at[id][targetRank];
    if (target == address(0)) {
      uint32 minAllowed = myRank > MAX_JUMP ? myRank - MAX_JUMP : 1;
      revert OutOfReach(minAllowed);
    }
    if (_busy[id][target] != 0) revert TargetBusy();

    if (msg.value != lad.stake) revert WrongPayment(lad.stake);

    cid = ++challengeCount;
    uint64 acceptBy = uint64(block.timestamp) + ACCEPT_WINDOW;

    _challenges[cid] = Challenge({
      ladderId: id,
      challenger: msg.sender,
      target: target,
      acceptBy: acceptBy,
      reportBy: 0,
      stake: lad.stake,
      state: State.Offered,
      reportC: 0,
      reportT: 0
    });

    _busy[id][msg.sender] = cid;
    _busy[id][target] = cid;

    emit Challenged(cid, id, msg.sender, target, acceptBy);
  }

  function accept(uint256 cid) external payable {
    if (cid == 0 || cid > challengeCount) revert NoSuchChallenge();
    Challenge storage c = _challenges[cid];

    if (msg.sender != c.target) revert NotTarget();
    if (c.state != State.Offered) revert WrongState();
    if (block.timestamp > c.acceptBy) revert TooLate();
    if (msg.value != c.stake) revert WrongPayment(c.stake);

    c.state = State.Active;
    c.reportBy = uint64(block.timestamp) + REPORT_WINDOW;

    emit Accepted(cid, c.reportBy);
  }

  function cancel(uint256 cid) external nonReentrant {
    if (cid == 0 || cid > challengeCount) revert NoSuchChallenge();
    Challenge storage c = _challenges[cid];

    if (msg.sender != c.challenger) revert NotChallenger();
    if (c.state != State.Offered) revert WrongState();

    c.state = State.Cancelled;
    _busy[c.ladderId][c.challenger] = 0;
    _busy[c.ladderId][c.target] = 0;

    uint256 refund = c.stake;
    (bool ok, ) = msg.sender.call{value: refund}("");
    if (!ok) revert TransferFailed();

    emit Cancelled(cid);
  }

  function walkover(uint256 cid) external nonReentrant {
    if (cid == 0 || cid > challengeCount) revert NoSuchChallenge();
    Challenge storage c = _challenges[cid];

    if (msg.sender != c.challenger) revert NotChallenger();
    if (c.state != State.Offered) revert WrongState();
    if (block.timestamp <= c.acceptBy) revert NotYet(c.acceptBy);

    c.state = State.Walkover;
    _busy[c.ladderId][c.challenger] = 0;
    _busy[c.ladderId][c.target] = 0;

    uint256 ladId = c.ladderId;
    uint32 cRank = _rank[ladId][c.challenger];
    uint32 tRank = _rank[ladId][c.target];

    // Swap if challenger is still below target
    if (cRank > tRank) {
      _at[ladId][tRank] = c.challenger;
      _at[ladId][cRank] = c.target;
      _rank[ladId][c.challenger] = tRank;
      _rank[ladId][c.target] = cRank;
    }

    uint256 refund = c.stake;
    (bool ok, ) = msg.sender.call{value: refund}("");
    if (!ok) revert TransferFailed();

    emit WalkedOver(cid, c.challenger, c.target);
  }

  function report(uint256 cid, bool challengerWon) external {
    if (cid == 0 || cid > challengeCount) revert NoSuchChallenge();
    Challenge storage c = _challenges[cid];

    if (msg.sender != c.challenger && msg.sender != c.target) revert NotAPlayer();
    if (c.state != State.Active) revert WrongState();
    if (block.timestamp > c.reportBy) revert ReportClosed();

    uint8 repVal = challengerWon ? 1 : 2;

    if (msg.sender == c.challenger) {
      if (c.reportC != 0) revert AlreadyReported();
      c.reportC = repVal;
    } else {
      if (c.reportT != 0) revert AlreadyReported();
      c.reportT = repVal;
    }

    emit Reported(cid, msg.sender, repVal);

    if (c.reportC != 0 && c.reportT != 0) {
      _busy[c.ladderId][c.challenger] = 0;
      _busy[c.ladderId][c.target] = 0;

      if (c.reportC == c.reportT) {
        c.state = State.Settled;
        address winner = c.reportC == 1 ? c.challenger : c.target;
        pending[winner] += uint256(c.stake) * 2;

        bool swapped = false;
        if (c.reportC == 1) {
          // Challenger won: swap if challenger is still below target
          uint256 ladId = c.ladderId;
          uint32 curCRank = _rank[ladId][c.challenger];
          uint32 curTRank = _rank[ladId][c.target];
          if (curCRank > curTRank) {
            _at[ladId][curTRank] = c.challenger;
            _at[ladId][curCRank] = c.target;
            _rank[ladId][c.challenger] = curTRank;
            _rank[ladId][c.target] = curCRank;
            swapped = true;
          }
        }
        emit Settled(cid, winner, swapped);
      } else {
        c.state = State.Void;
        pending[c.challenger] += c.stake;
        pending[c.target] += c.stake;
        emit Voided(cid, "disagreed");
      }
    }
  }

  function voidChallenge(uint256 cid) external {
    if (cid == 0 || cid > challengeCount) revert NoSuchChallenge();
    Challenge storage c = _challenges[cid];

    if (c.state != State.Active) revert WrongState();
    if (block.timestamp <= c.reportBy) revert StillOpen(c.reportBy);

    c.state = State.Void;
    _busy[c.ladderId][c.challenger] = 0;
    _busy[c.ladderId][c.target] = 0;

    pending[c.challenger] += c.stake;
    pending[c.target] += c.stake;

    emit Voided(cid, "no agreement");
  }

  function withdraw() external nonReentrant {
    uint256 amount = pending[msg.sender];
    if (amount == 0) revert NothingToWithdraw();

    pending[msg.sender] = 0;

    (bool ok, ) = msg.sender.call{value: amount}("");
    if (!ok) revert TransferFailed();

    emit Withdrawn(msg.sender, amount);
  }

  // --- Views ---

  function ladderOf(uint256 id) external view returns (Ladder memory) {
    if (id == 0 || id > ladderCount) revert NoSuchLadder();
    return _ladders[id];
  }

  function standings(uint256 id, uint32 offset, uint32 count)
    external
    view
    returns (address[] memory list)
  {
    if (id == 0 || id > ladderCount) revert NoSuchLadder();
    if (count > MAX_PAGE) count = uint32(MAX_PAGE);

    uint32 total = _ladders[id].count;
    if (offset >= total) {
      return new address[](0);
    }

    if (offset + count > total) {
      count = total - offset;
    }

    list = new address[](count);
    for (uint32 i = 0; i < count; i++) {
      list[i] = _at[id][offset + i + 1];
    }
  }

  function rankOf(uint256 id, address who) external view returns (uint32) {
    if (id == 0 || id > ladderCount) revert NoSuchLadder();
    return _rank[id][who];
  }

  function busyOf(uint256 id, address who) external view returns (uint256) {
    if (id == 0 || id > ladderCount) revert NoSuchLadder();
    return _busy[id][who];
  }

  function challengeOf(uint256 cid) external view returns (Challenge memory) {
    if (cid == 0 || cid > challengeCount) revert NoSuchChallenge();
    return _challenges[cid];
  }

  function latest(uint256 offset, uint256 count)
    external
    view
    returns (uint256[] memory ids, Ladder[] memory list)
  {
    if (count > MAX_PAGE) count = MAX_PAGE;
    uint256 total = ladderCount;
    if (offset >= total) {
      return (new uint256[](0), new Ladder[](0));
    }

    if (offset + count > total) {
      count = total - offset;
    }

    ids = new uint256[](count);
    list = new Ladder[](count);

    for (uint256 i = 0; i < count; i++) {
      uint256 lId = total - (offset + i);
      ids[i] = lId;
      list[i] = _ladders[lId];
    }
  }
}
