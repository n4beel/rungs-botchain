# Architecture & Design Decisions: Rungs

## 1. Disagreement Voids Challenge Instead of Siding With Either Player
- **Decision**: When players submit contradictory reports (`reportC != reportT`), the challenge transitions directly to `State.Void`, returning both players' stakes to their `pending` balances and leaving ladder ranks unchanged.
- **Rationale**: The contract operates entirely on-chain without an external oracle or referee watching the physical / off-chain match. Siding with either the challenger or target arbitrarily or based on report timestamps would introduce perverse game-theoretic incentives (e.g. race to submit first, or asymmetric defender advantage). Returning both stakes prevents theft and ensures rank progression occurs strictly on mutually certified results.

## 2. Dynamic Rank Swapping Using Current Positions
- **Decision**: Rank swaps (`curCRank > curTRank`) evaluate the players' ranks at the moment of settlement or walkover rather than their historical ranks when the challenge was opened.
- **Rationale**: While two players are busy in an active challenge, other ladder ranks might shift if future extensions allow concurrent matches across different tiers. Checking `curCRank > curTRank` guarantees a player never inadvertently drops rank when claiming a win.

## 3. Pull Payment Architecture for Stakes and Match Winnings
- **Decision**: Winnings (`2 * stake`) and voided refunds are credited to `pending[address]` and claimed via `withdraw()`, except for direct self-cancellations where the caller's own funds are immediately returned.
- **Rationale**: Decouples external ETH transfers from core ladder state transitions, preventing any reentrant or reverting recipient contract from stalling settlements, joins, or voids.

## 4. Mutation Testing & Equivalent Mutants
- Mutation testing killed 21 of 25 selected mutants (84% kill rate).
- Surviving mutants are equivalent or defensive boundary guards:
  - `Rungs.sol:160` (`uint32 minAllowed = myRank > MAX_JUMP ? myRank - MAX_JUMP : 1;` mutant `+ MAX_JUMP`): Defensive fallback when `target == address(0)`. Because membership ranks `1..count` are strictly contiguous with no gaps (verified by the invariant suite), `_at[id][targetRank]` never returns zero for any `1 <= targetRank < myRank`.
  - `Rungs.sol:354` (`if (offset + count > total)` vs `>=`): When `offset + count == total`, `count = total - offset` re-assigns `count` to the exact same value (`count`), producing an identical slice length.
  - `Rungs.sol:287` (`if (curCRank > curTRank)` vs `>=`): Ranks in a ladder are strictly unique (1 player per rank). Therefore `curCRank == curTRank` is impossible in any valid ladder state; replacing `>` with `>=` produces identical behavior.
  - `Rungs.sol:238` (`if (cRank > tRank)` vs `>=`): Challenger rank is strictly greater than target rank at challenge creation time (`myRank > targetRank`). Therefore `cRank == tRank` cannot occur; substituting `>=` has no observable effect.
