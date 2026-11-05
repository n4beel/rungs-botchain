// lib/rungs.ts - Pure reference models, layout and algorithms for Rungs (Spec §2, §4)

export enum ChallengeState {
  Offered = 0,
  Active = 1,
  Settled = 2,
  Void = 3,
  Walkover = 4,
  Cancelled = 5,
}

export function reach(myRank: number): number[] {
  if (myRank <= 1) return [];
  const ranks: number[] = [];
  const min = Math.max(1, myRank - 3);
  for (let r = myRank - 1; r >= min; r--) {
    ranks.push(r);
  }
  return ranks;
}

export type Outcome = "pending" | "agreed" | "disagreed";

export function outcomeOf(reportC: number, reportT: number): Outcome {
  if (reportC === 0 || reportT === 0) {
    return "pending";
  }
  if (reportC === reportT) {
    return "agreed";
  }
  return "disagreed";
}

export function swapped(ranks: string[], cRank: number, tRank: number): string[] {
  const next = [...ranks];
  if (cRank > tRank && cRank <= next.length && tRank >= 1) {
    const temp = next[tRank - 1];
    next[tRank - 1] = next[cRank - 1];
    next[cRank - 1] = temp;
  }
  return next;
}

export interface LadderRow {
  rank: number;
  player: string;
  isCurrentUser: boolean;
  canChallenge: boolean;
  isBusy: boolean;
  activeChallengeId: bigint | null;
}

export function ladderRows(
  standings: string[],
  userAddress?: string,
  userRank?: number,
  busyMap: Record<string, bigint> = {}
): LadderRow[] {
  const normUser = userAddress?.toLowerCase();
  const allowedReach = userRank ? reach(userRank) : [];

  return standings.map((playerAddr, idx) => {
    const rank = idx + 1;
    const isCurrentUser = normUser === playerAddr.toLowerCase();
    const busyCid = busyMap[playerAddr.toLowerCase()] || 0n;
    const isBusy = busyCid > 0n;

    const canChallenge =
      !isCurrentUser &&
      Boolean(userRank) &&
      !isBusy &&
      allowedReach.includes(rank);

    return {
      rank,
      player: playerAddr,
      isCurrentUser,
      canChallenge,
      isBusy,
      activeChallengeId: isBusy ? busyCid : null,
    };
  });
}

export function formatAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
