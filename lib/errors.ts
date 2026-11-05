// lib/errors.ts - Formats Rungs errors per spec §4

export function formatRungsError(error: unknown): string {
  if (!error) return "An unknown error occurred.";
  const message = error instanceof Error ? error.message : String(error);

  const outOfReachMatch = message.match(/OutOfReach\((\d+)\)/);
  if (outOfReachMatch) {
    const minRank = outOfReachMatch[1];
    return `You can challenge rungs ${minRank} to above you (up to 3 rungs).`;
  }
  if (message.includes("OutOfReach")) {
    return "Target rung is out of reach. You can only challenge up to three rungs above you.";
  }
  if (message.includes("TargetBusy")) {
    return "That player is in another challenge.";
  }
  if (message.includes("Busy")) {
    return "You have a challenge in progress.";
  }
  if (message.includes("TooLate")) {
    return "The three days to accept have passed.";
  }
  if (message.includes("AlreadyReported")) {
    return "You have already reported the match result.";
  }
  if (message.includes("LadderFull")) {
    return "Ladder is full (maximum 50 players reached).";
  }
  if (message.includes("AlreadyMember")) {
    return "You are already a member of this ladder.";
  }
  if (message.includes("NotMember")) {
    return "You must join this ladder before making a challenge.";
  }
  if (message.includes("WrongPayment")) {
    return "Incorrect stake amount provided.";
  }
  if (message.includes("NotTarget")) {
    return "Only the challenged player can accept this challenge.";
  }
  if (message.includes("NotChallenger")) {
    return "Only the challenger can cancel or claim walkover.";
  }
  if (message.includes("ReportClosed")) {
    return "Reporting window for this challenge has closed.";
  }
  if (message.includes("NotYet")) {
    return "Cannot claim walkover until the 3-day acceptance window expires.";
  }
  if (message.includes("StillOpen")) {
    return "Challenge report window is still open.";
  }
  if (message.includes("NothingToWithdraw")) {
    return "No pending funds to withdraw.";
  }
  if (message.includes("TransferFailed")) {
    return "Transfer failed. Please check recipient wallet or gas.";
  }

  return message;
}
