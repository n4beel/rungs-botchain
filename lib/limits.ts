// lib/limits.ts - Constants mirrored from contracts/src/Rungs.sol

export const MAX_NAME_BYTES = 48;
export const MAX_MEMBERS = 50;
export const MAX_JUMP = 3;
export const MIN_STAKE = 10000000000000000n; // 0.01 ether
export const MAX_STAKE = 1000000000000000000000n; // 1000 ether
export const ACCEPT_WINDOW = 259200; // 3 days in seconds (3 * 86400)
export const REPORT_WINDOW = 604800; // 7 days in seconds (7 * 86400)
export const MAX_PAGE = 50;
