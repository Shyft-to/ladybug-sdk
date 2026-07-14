import { describe, expect, it } from "vitest";
import { PublicKey } from "@solana/web3.js";

import { buildFilterSets } from "../filters";

const MINT_A = "So11111111111111111111111111111111111111112";
const MINT_B = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

describe("buildFilterSets", () => {
  it("builds both mint orderings when both mints are given", () => {
    const sets = buildFilterSets(10, 20, MINT_A, MINT_B);

    expect(sets).toEqual([
      [
        { memcmp: { offset: 10, bytes: new PublicKey(MINT_A).toBase58() } },
        { memcmp: { offset: 20, bytes: new PublicKey(MINT_B).toBase58() } },
      ],
      [
        { memcmp: { offset: 10, bytes: new PublicKey(MINT_B).toBase58() } },
        { memcmp: { offset: 20, bytes: new PublicKey(MINT_A).toBase58() } },
      ],
    ]);
  });

  it("matches either slot when only mintA is given", () => {
    const sets = buildFilterSets(10, 20, MINT_A, undefined);

    expect(sets).toEqual([
      [{ memcmp: { offset: 10, bytes: MINT_A } }],
      [{ memcmp: { offset: 20, bytes: MINT_A } }],
    ]);
  });

  it("matches either slot when only mintB is given", () => {
    const sets = buildFilterSets(10, 20, undefined, MINT_B);

    expect(sets).toEqual([
      [{ memcmp: { offset: 10, bytes: MINT_B } }],
      [{ memcmp: { offset: 20, bytes: MINT_B } }],
    ]);
  });

  it("throws when neither mint is given", () => {
    expect(() => buildFilterSets(10, 20)).toThrow(
      "At least one of baseMint/quoteMint must be provided",
    );
  });

  it("throws for an invalid mint address", () => {
    expect(() => buildFilterSets(10, 20, "not-a-valid-pubkey")).toThrow();
  });
});
