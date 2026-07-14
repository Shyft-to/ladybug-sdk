import { describe, expect, it, vi } from "vitest";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

import { getRawAccountsByMintOffsets } from "../gpa";

const PROGRAM_ID = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const MINT_A = "So11111111111111111111111111111111111111112";
const MINT_B = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function makeAccount(owner: string, lamports: number, data: Buffer) {
  return { owner: new PublicKey(owner), lamports, data, executable: false, rentEpoch: 0 };
}

function fakeConnection(getProgramAccounts: ReturnType<typeof vi.fn>): Connection {
  return { getProgramAccounts } as unknown as Connection;
}

describe("getRawAccountsByMintOffsets", () => {
  it("merges and de-dupes accounts across both filter-set queries", async () => {
    const dupPubkey = Keypair.generate().publicKey;
    const uniquePubkey = Keypair.generate().publicKey;

    const getProgramAccounts = vi
      .fn()
      // first filter set (A-at-offsetA, B-at-offsetB)
      .mockResolvedValueOnce([
        { pubkey: dupPubkey, account: makeAccount(PROGRAM_ID, 100, Buffer.from("a")) },
      ])
      // second filter set (B-at-offsetA, A-at-offsetB)
      .mockResolvedValueOnce([
        { pubkey: dupPubkey, account: makeAccount(PROGRAM_ID, 100, Buffer.from("a")) },
        { pubkey: uniquePubkey, account: makeAccount(PROGRAM_ID, 200, Buffer.from("b")) },
      ]);

    const connection = fakeConnection(getProgramAccounts);
    const result = await getRawAccountsByMintOffsets(
      connection,
      PROGRAM_ID,
      400,
      432,
      MINT_A,
      MINT_B,
    );

    expect(getProgramAccounts).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.pubkey).sort()).toEqual(
      [dupPubkey.toBase58(), uniquePubkey.toBase58()].sort(),
    );
  });

  it("shapes raw account fields as base64/owner/lamports", async () => {
    const pubkey = new PublicKey("So11111111111111111111111111111111111111112");
    const data = Buffer.from("hello");
    const getProgramAccounts = vi
      .fn()
      .mockResolvedValueOnce([{ pubkey, account: makeAccount(PROGRAM_ID, 42, data) }])
      .mockResolvedValueOnce([]);

    const connection = fakeConnection(getProgramAccounts);
    const [account] = await getRawAccountsByMintOffsets(
      connection,
      PROGRAM_ID,
      400,
      432,
      MINT_A,
    );

    expect(account).toEqual({
      pubkey: pubkey.toBase58(),
      owner: PROGRAM_ID,
      lamports: 42,
      dataLength: data.length,
      dataBase64: data.toString("base64"),
    });
  });

  it("propagates errors thrown while building filters (no mint provided)", async () => {
    const connection = fakeConnection(vi.fn());
    await expect(
      getRawAccountsByMintOffsets(connection, PROGRAM_ID, 400, 432),
    ).rejects.toThrow("At least one of baseMint/quoteMint must be provided");
  });
});
