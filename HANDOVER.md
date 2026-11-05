# Project 65 — Rungs Handover

- **Status**: Handed over
- **Folder**: `rungs-botchain/`
- **Contract**: `Rungs` (`contracts/src/Rungs.sol`)
- **Archetype**: AR · Ladder (`#845616` ground, `#5A3A0F` surface, `#FFF8EA` ink, `#F4D35E` accent)
- **Typography**: Rubik (headings/UI), Bodoni Moda (names/ranks), Kode Mono (dates/numbers/addresses)

---

## Deliverables Summary

1. **Smart Contracts (`contracts/src/Rungs.sol`)**:
   - `create(name, stake)`: Initialises challenge ladder with fixed stake (0.01 - 1000 BOT) and name (≤ 48 bytes).
   - `join(id)`: Appends player to bottom rung (`count + 1`, max 50 players).
   - `challenge(id, targetRank)`: Stakes entry to challenge an opponent up to 3 rungs above (`1 <= myRank - targetRank <= 3`).
   - `accept(cid)`: Target matches stake within 3 days (`ACCEPT_WINDOW`).
   - `cancel(cid)`: Challenger cancels before acceptance, receiving their deposit back directly.
   - `walkover(cid)`: If target fails to accept in 3 days, challenger retrieves stake and swaps ranks.
   - `report(cid, challengerWon)`: Mutual reporting within 7 days (`REPORT_WINDOW`). Agreed winner receives `2 * stake`; challenger winning swaps ranks. Disagreed voids match and refunds both stakes to `pending`.
   - `voidChallenge(cid)`: Anyone can void match after report window elapsed if unconfirmed.
   - `withdraw()`: Pull payments for winnings and void refunds with reentrancy protection.
   - 21 Foundry tests (20 unit/fuzz + 1 invariant with 128,000 calls, 0 reverts).

2. **Frontend UI & Visual Ladder**:
   - Vertical SVG/styled ladder with rails and rungs, responsive single column on mobile (≥ 360px).
   - Accessible table toggle for screen readers and tab navigation.
   - Interactive match screen (`/challenge/[id]`) showing hidden opponent report until both submit.
   - User match dashboard (`/me`) for active memberships, ongoing challenges, and 1-click withdraw.
   - Ladder creation form (`/new`) with byte length counting and stake range validation.

3. **Verification**:
   - Mutation check: 21/25 killed (84%), remaining 4 verified equivalent in `contracts/DECISIONS.md`.
   - Integration test: full path on Anvil (port 8665).
   - Next.js production build: compiles cleanly with zero TypeScript or lint errors.
   - Scripts:
     - `python3 scripts/check-distinct.py rungs` -> OK
     - `python3 scripts/check-tokens.py rungs` -> OK
     - `python3 scripts/check-ui-contract.py rungs` -> OK
     - `python3 scripts/check-honesty.py rungs` -> OK
