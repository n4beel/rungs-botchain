# Rungs — Challenge Ladder on BotChain

> "Challenge someone above you. Win and swap places."

Rungs is a challenge ladder contract and application for sports, e-sports, chess, or local leagues. Anyone can create a ladder with a fixed stake, and players join at the bottom rung. Any player can challenge an opponent up to three rungs above them by depositing the stake. Both players play off-chain and mutually report the result. If both agree, the winner takes both stakes (2×) and, if the challenger won, they swap places on the ladder.

---

## Architecture & Domain Rules

1. **Ladder Membership**:
   - Ladders support up to 50 players (`MAX_MEMBERS = 50`).
   - Members join at `count + 1`.
   - Fixed stake between 0.01 and 1000 BOT (`MIN_STAKE` to `MAX_STAKE`).
2. **Challenge Constraints**:
   - Rung jump distance: `1 <= myRank - targetRank <= 3` (`MAX_JUMP = 3`).
   - Both challenger and target are marked busy (`_busy`) and cannot enter another match simultaneously.
3. **Acceptance & Walkover Window**:
   - The target has 3 days (`ACCEPT_WINDOW = 3 days`) to match the stake and accept.
   - If the target does not accept within 3 days, the challenger can claim `walkover()`, retrieving their stake and swapping ranks with the inactive defender.
   - The challenger can cancel freely before the defender accepts.
4. **Mutual Reporting & Settlement**:
   - After acceptance, players have 7 days (`REPORT_WINDOW = 7 days`) to report the match outcome.
   - If both agree on the winner:
     - Winner is credited with the combined `2 * stake` prize in `pending`.
     - If the challenger won, current ranks are swapped (`curCRank > curTRank`).
     - State becomes `Settled`.
   - If reports disagree:
     - Match transitions to `Void`.
     - Both stakes are refunded to each player's `pending` balance.
     - Ladder ranks remain unchanged.
   - If 7 days pass without both reporting, anyone can call `voidChallenge()` to refund stakes.
5. **Pull Payments**:
   - Stakes and prizes are claimed through `withdraw()` following the checks-effects-interactions pattern with reentrancy protection.

---

## Design System Tokens & WCAG Contrast

- **Layout Archetype**: AR · Ladder
- **Type**:
  - Headings / UI: Rubik
  - Names / Ranks: Bodoni Moda
  - Figures / Addresses: Kode Mono
- **Palette Tokens**:
  - `--bg-base`: `#845616` (ground)
  - `--bg-surface`: `#5A3A0F` (surface)
  - `--text-primary`: `#FFF8EA` (ink)
  - `--text-muted`: `#E9DBC4` (muted)
  - `--accent`: `#F4D35E` (accent)
  - `--accent-ink`: `#2B1A00`
  - `--border-default`: `#9F7A45`
  - `--border-subtle`: `#92682D`
- **Measured WCAG Contrast Ratios**:
  - Ink on Ground: **5.98:1** (WCAG AA pass)
  - Ink on Surface: **9.71:1** (WCAG AAA pass)
  - Muted on Surface: **7.52:1** (WCAG AAA pass)
  - Accent-Ink on Accent: **11.46:1** (WCAG AAA pass)
  - Menu Text on Menu BG: **9.71:1** (WCAG AAA pass)
  - Menu Muted on Menu BG: **4.63:1** (WCAG AA pass)

---

## Testing & Verification

- **Foundry Unit & Invariant Tests**:
  - 20 unit/fuzz tests covering all contract lifecycle pathways, boundaries, and revert reasons.
  - 1 invariant test executing 128,000 handler calls verifying solvency (`balance == sum(locked) + sum(pending)`) and zero reverts.
- **Mutation Testing**:
  - 21 of 25 mutants killed (84% kill rate); 4 survivors verified as equivalent mutants in `contracts/DECISIONS.md`.
- **Vitest Unit & Integration**:
  - 47 frontend unit tests passing.
  - 5 integration tests against Anvil (port 8665) verifying ABI parity and the full ladder lifecycle.
- **Verification Scripts**:
  - `check-distinct.py`: Pass (0 collisions)
  - `check-tokens.py`: Pass (0 undefined tokens)
  - `check-ui-contract.py`: Pass (3-link footer, active chain enforcement)
  - `check-honesty.py`: Pass (0 findings)
