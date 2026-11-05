import { describe, it, expect } from "vitest";
import { reach, outcomeOf, swapped, ladderRows, ChallengeState } from "../rungs";
import { formatRungsError } from "../errors";

describe("Rungs lib tests", () => {
  it("calculates reach correctly (up to 3 ranks above)", () => {
    expect(reach(1)).toEqual([]);
    expect(reach(2)).toEqual([1]);
    expect(reach(4)).toEqual([3, 2, 1]);
    expect(reach(6)).toEqual([5, 4, 3]);
  });

  it("determines outcome from reports", () => {
    expect(outcomeOf(0, 0)).toBe("pending");
    expect(outcomeOf(1, 0)).toBe("pending");
    expect(outcomeOf(1, 1)).toBe("agreed");
    expect(outcomeOf(2, 2)).toBe("agreed");
    expect(outcomeOf(1, 2)).toBe("disagreed");
  });

  it("swaps ranks between challenger and target", () => {
    const players = ["Alice", "Bob", "Charlie", "David"];
    // Charlie (rank 3) beats Bob (rank 2)
    const result = swapped(players, 3, 2);
    expect(result).toEqual(["Alice", "Charlie", "Bob", "David"]);
  });

  it("generates ladder rows with challenge eligibility", () => {
    const standings = [
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
      "0x3333333333333333333333333333333333333333",
      "0x4444444444444444444444444444444444444444",
    ];

    // User is rank 4 (0x4444...)
    const rows = ladderRows(
      standings,
      "0x4444111111111111111111111111111111114444",
      4,
      { [standings[1].toLowerCase()]: 12n } // rank 2 is busy
    );

    expect(rows.length).toBe(4);
    // Rank 1 (can challenge)
    expect(rows[0].canChallenge).toBe(true);
    // Rank 2 (busy -> cannot challenge)
    expect(rows[1].canChallenge).toBe(false);
    expect(rows[1].isBusy).toBe(true);
    // Rank 3 (can challenge)
    expect(rows[2].canChallenge).toBe(true);
  });

  it("formats error messages accurately", () => {
    expect(formatRungsError(new Error("Busy()"))).toBe("You have a challenge in progress.");
    expect(formatRungsError(new Error("TargetBusy()"))).toBe("That player is in another challenge.");
    expect(formatRungsError(new Error("TooLate()"))).toBe("The three days to accept have passed.");
    expect(formatRungsError(new Error("OutOfReach(2)"))).toBe(
      "You can challenge rungs 2 to above you (up to 3 rungs)."
    );
  });
});
