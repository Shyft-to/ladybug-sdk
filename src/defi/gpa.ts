import { Connection, PublicKey } from "@solana/web3.js";

import { buildFilterSets } from "./filters";
import { RawPoolAccount } from "./types";

/**
 * Runs `getProgramAccounts` for a single program, filtering on the two
 * token-mint offsets, and returns the matching accounts as raw (undecoded)
 * bytes. This is the shared GPA primitive every raw pool lookup builds on.
 *
 * Pass both mints to match a specific pair, or a single mint to match every
 * account holding that mint in either slot. Both mint orderings are queried,
 * and the results are merged and de-duplicated by pubkey.
 *
 * @param connection - A Solana `Connection`.
 * @param programId - The program that owns the accounts.
 * @param offsetA - Byte offset of the first mint in the account layout.
 * @param offsetB - Byte offset of the second mint in the account layout.
 * @param mintA - First mint to filter on (optional).
 * @param mintB - Second mint to filter on (optional).
 * @returns The matching accounts as raw base64 data.
 * @throws If neither `mintA` nor `mintB` is provided.
 */
export async function getRawAccountsByMintOffsets(
  connection: Connection,
  programId: string | PublicKey,
  offsetA: number,
  offsetB: number,
  mintA?: string,
  mintB?: string,
): Promise<RawPoolAccount[]> {
  const filterSets = buildFilterSets(offsetA, offsetB, mintA, mintB);
  const programPubkey =
    typeof programId === "string" ? new PublicKey(programId) : programId;

  const resultsBySet = await Promise.all(
    filterSets.map((filters) =>
      connection.getProgramAccounts(programPubkey, { filters, encoding: "base64" }),
    ),
  );

  const seen = new Set<string>();
  const accounts: RawPoolAccount[] = [];

  for (const results of resultsBySet) {
    for (const { pubkey, account } of results) {
      const key = pubkey.toBase58();
      if (seen.has(key)) continue;
      seen.add(key);
      accounts.push({
        pubkey: key,
        owner: account.owner.toBase58(),
        lamports: account.lamports,
        dataLength: account.data.length,
        dataBase64: account.data.toString("base64"),
      });
    }
  }

  return accounts;
}
