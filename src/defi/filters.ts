import { PublicKey } from "@solana/web3.js";
import { MemcmpFilter } from "./types";

/**
 * Builds the sets of memcmp filters to query for a pair of mint offsets.
 *
 * A DEX pool stores two mints, but which mint lands in slot A vs slot B is not
 * fixed, so we query both orderings and merge the results.
 *
 *  - both mints given    -> [A-at-offsetA & B-at-offsetB], [B-at-offsetA & A-at-offsetB]
 *  - only one mint given -> [mint-at-offsetA], [mint-at-offsetB] (matches either slot)
 *
 * @param offsetA - Byte offset of the first mint in the pool account.
 * @param offsetB - Byte offset of the second mint in the pool account.
 * @param mintA - The first mint to filter on (optional).
 * @param mintB - The second mint to filter on (optional).
 * @returns One or more filter sets; each set is ANDed, the sets are ORed.
 * @throws If neither mint is provided.
 */
export function buildFilterSets(
  offsetA: number,
  offsetB: number,
  mintA?: string,
  mintB?: string,
): MemcmpFilter[][] {
  if (mintA && mintB) {
    const a = new PublicKey(mintA).toBase58();
    const b = new PublicKey(mintB).toBase58();
    return [
      [{ memcmp: { offset: offsetA, bytes: a } }, { memcmp: { offset: offsetB, bytes: b } }],
      [{ memcmp: { offset: offsetA, bytes: b } }, { memcmp: { offset: offsetB, bytes: a } }],
    ];
  }

  const singleMint = mintA ?? mintB;
  if (!singleMint) {
    throw new Error("At least one of baseMint/quoteMint must be provided");
  }
  const bytes = new PublicKey(singleMint).toBase58();

  return [
    [{ memcmp: { offset: offsetA, bytes } }],
    [{ memcmp: { offset: offsetB, bytes } }],
  ];
}
