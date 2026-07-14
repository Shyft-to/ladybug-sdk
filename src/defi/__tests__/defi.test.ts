import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

import { Defi } from "../defi";
import {
  DEFAULT_DEX_OFFSETS,
  METEORA_DLMM_PROGRAM_ID,
  ORCA_WHIRLPOOL_PROGRAM_ID,
  RAYDIUM_AMM_V4_PROGRAM_ID,
} from "../constants";
import type { Parser } from "../../parsers/parser";

const MINT_A = "So11111111111111111111111111111111111111112";
const MINT_B = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const RAYDIUM_PUBKEY_FIELDS = [
  "baseVault", "quoteVault", "baseMint", "quoteMint", "lpMint", "openOrders",
  "marketId", "marketProgramId", "targetOrders", "withdrawQueue", "lpVault", "owner",
] as const;

/** Builds a valid `LiquidityStateV4` buffer (752 bytes); pubkey fields default to the zero key. */
function buildRaydiumBuffer(
  overrides: Partial<Record<(typeof RAYDIUM_PUBKEY_FIELDS)[number], PublicKey>> = {},
): Buffer {
  const zeroKey = new PublicKey(Buffer.alloc(32));
  const chunks: Buffer[] = [Buffer.alloc(256 + 80)]; // 32 u64 fields + swap amount fields
  for (const field of RAYDIUM_PUBKEY_FIELDS) {
    chunks.push((overrides[field] ?? zeroKey).toBuffer());
  }
  chunks.push(Buffer.alloc(8 + 24)); // lpReserve + padding
  return Buffer.concat(chunks);
}

function rawProgramAccount(pubkey: PublicKey, owner: string, data: Buffer) {
  return {
    pubkey,
    account: { owner: new PublicKey(owner), lamports: 1, data, executable: false, rentEpoch: 0 },
  };
}

function accountInfo(owner: PublicKey, data: Buffer) {
  return { owner, lamports: 1, data, executable: false, rentEpoch: 0 };
}

describe("Defi raw pool fetching", () => {
  let getProgramAccounts: ReturnType<typeof vi.fn>;
  let connection: Connection;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns one entry per known DEX, keyed by DEX name, with pools/programId", async () => {
    getProgramAccounts = vi.fn().mockResolvedValue([]);
    connection = { getProgramAccounts } as unknown as Connection;

    const defi = new Defi(connection);
    const result = await defi.getPoolsByTokenPair(MINT_A, MINT_B);

    expect(result).toEqual({
      success: true,
      message: "Pools fetched successfully",
      result: { dexes: expect.any(Object) },
    });
    const dexes = result.result!.dexes;
    expect(Object.keys(dexes).sort()).toEqual(
      Object.values(DEFAULT_DEX_OFFSETS).map((d) => d.name).sort(),
    );
    for (const dex of Object.values(dexes)) expect(dex.pools).toEqual([]);
  });

  it("isolates a per-DEX failure: one DEX throwing yields [] for it, others unaffected", async () => {
    const raydiumPool = rawProgramAccount(
      Keypair.generate().publicKey,
      RAYDIUM_AMM_V4_PROGRAM_ID,
      buildRaydiumBuffer(),
    );

    getProgramAccounts = vi.fn().mockImplementation(async (programId: PublicKey) => {
      const id = programId.toBase58();
      if (id === RAYDIUM_AMM_V4_PROGRAM_ID) return [raydiumPool];
      if (id === METEORA_DLMM_PROGRAM_ID) throw new Error("RPC boom");
      return [];
    });
    connection = { getProgramAccounts } as unknown as Connection;

    const defi = new Defi(connection);
    const result = await defi.getPoolsForToken(MINT_A);

    const dexes = result.result!.dexes;
    expect(dexes["raydiumAmm"].pools).toHaveLength(1);
    expect(dexes["meteoraDlmm"].pools).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("suppresses error logging once enableLogging(false) is set", async () => {
    getProgramAccounts = vi.fn().mockRejectedValue(new Error("RPC boom"));
    connection = { getProgramAccounts } as unknown as Connection;

    const defi = new Defi(connection).enableLogging(false);
    await defi.getPoolsForToken(MINT_A);

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

describe("Defi decoded pool fetching", () => {
  it("decodes Raydium pools via the static struct, flattened with pubkey/lamports/_updatedAt", async () => {
    const pubkey = Keypair.generate().publicKey;
    const getProgramAccounts = vi.fn().mockImplementation(async (programId: PublicKey) => {
      if (programId.toBase58() === RAYDIUM_AMM_V4_PROGRAM_ID) {
        return [rawProgramAccount(pubkey, RAYDIUM_AMM_V4_PROGRAM_ID, buildRaydiumBuffer())];
      }
      return [];
    });
    const connection = { getProgramAccounts } as unknown as Connection;

    const defi = new Defi(connection);
    const result = await defi.getPoolsForToken(MINT_A);
    const pool = result.result!.dexes["raydiumAmm"].pools[0];

    expect(pool.baseMint).toBeDefined();
    expect(pool.pubkey).toBe(pubkey.toBase58());
    expect(typeof pool.lamports).toBe("number");
    expect(pool).not.toHaveProperty("decodedBy");
    expect(pool).not.toHaveProperty("dataLength");
  });

  it("falls back to a `data` key when the Raydium buffer can't be decoded", async () => {
    const pubkey = Keypair.generate().publicKey;
    const getProgramAccounts = vi.fn().mockImplementation(async (programId: PublicKey) => {
      if (programId.toBase58() === RAYDIUM_AMM_V4_PROGRAM_ID) {
        return [rawProgramAccount(pubkey, RAYDIUM_AMM_V4_PROGRAM_ID, Buffer.alloc(10))];
      }
      return [];
    });
    const connection = { getProgramAccounts } as unknown as Connection;

    const defi = new Defi(connection).enableLogging(false);
    const result = await defi.getPoolsForToken(MINT_A);
    const pool = result.result!.dexes["raydiumAmm"].pools[0];

    expect(typeof pool.data).toBe("string");
    expect(pool).not.toHaveProperty("decodedBy");
    expect(pool).not.toHaveProperty("dataLength");
  });

  it("decodes via the attached parser's IDL, flattening the parsed fields directly", async () => {
    const pubkey = Keypair.generate().publicKey;
    const getProgramAccounts = vi.fn().mockImplementation(async (programId: PublicKey) => {
      if (programId.toBase58() === ORCA_WHIRLPOOL_PROGRAM_ID) {
        return [rawProgramAccount(pubkey, ORCA_WHIRLPOOL_PROGRAM_ID, Buffer.from("ignored"))];
      }
      return [];
    });
    const connection = { getProgramAccounts } as unknown as Connection;

    const fakeParser = {
      hasParser: vi.fn((programId: string) => programId === ORCA_WHIRLPOOL_PROGRAM_ID),
      parseAccount: vi.fn().mockReturnValue({
        parsed: { accountName: "Whirlpool", parsed: { token_mint_a: MINT_A } },
      }),
    } as unknown as Parser;

    const defi = new Defi(connection).addParser(fakeParser);
    const result = await defi.getPoolsForToken(MINT_A);
    const pool = result.result!.dexes["orca"].pools[0];

    expect(pool.token_mint_a).toBe(MINT_A);
    expect(pool).not.toHaveProperty("accountName");
    expect(pool).not.toHaveProperty("owner");
    expect(pool).not.toHaveProperty("decodedBy");
    expect(pool).not.toHaveProperty("dataLength");
  });

  it("returns a `data` fallback when no parser is attached and the program has no static decoder", async () => {
    const pubkey = Keypair.generate().publicKey;
    const getProgramAccounts = vi.fn().mockImplementation(async (programId: PublicKey) => {
      if (programId.toBase58() === ORCA_WHIRLPOOL_PROGRAM_ID) {
        return [rawProgramAccount(pubkey, ORCA_WHIRLPOOL_PROGRAM_ID, Buffer.from("data"))];
      }
      return [];
    });
    const connection = { getProgramAccounts } as unknown as Connection;

    const defi = new Defi(connection); // no addParser
    const result = await defi.getPoolsForToken(MINT_A);
    const pool = result.result!.dexes["orca"].pools[0];

    expect(typeof pool.data).toBe("string");
    expect(pool).not.toHaveProperty("decodedBy");
    expect(pool).not.toHaveProperty("dataLength");
  });

  it("filters to the requested DEXes and rejects unknown DEX names", async () => {
    const getProgramAccounts = vi.fn().mockResolvedValue([]);
    const connection = { getProgramAccounts } as unknown as Connection;
    const defi = new Defi(connection);

    await defi.getPoolsByTokenPair(MINT_A, MINT_B, ["orca"]);
    for (const call of getProgramAccounts.mock.calls) {
      expect((call[0] as PublicKey).toBase58()).toBe(ORCA_WHIRLPOOL_PROGRAM_ID);
    }

    // @ts-expect-error intentionally invalid DEX name
    await expect(defi.getPoolsByTokenPair(MINT_A, MINT_B, ["notADex"])).rejects.toThrow(
      /Unknown DEX name/,
    );
  });
});

describe("Defi.getPoolsByAddress", () => {
  it("rejects an invalid address", async () => {
    const connection = { getAccountInfo: vi.fn() } as unknown as Connection;
    const defi = new Defi(connection);

    const result = await defi.getPoolsByAddress("not-an-address");
    expect(result).toEqual({ success: false, message: "Invalid address: not-an-address" });
  });

  it("reports when the account doesn't exist", async () => {
    const getAccountInfo = vi.fn().mockResolvedValue(null);
    const connection = { getAccountInfo } as unknown as Connection;
    const defi = new Defi(connection);

    const address = Keypair.generate().publicKey.toBase58();
    const result = await defi.getPoolsByAddress(address);
    expect(result).toEqual({ success: false, message: `No account found for ${address}` });
  });

  it("reports when no parser is available for the owning program", async () => {
    const owner = Keypair.generate().publicKey;
    const getAccountInfo = vi.fn().mockResolvedValue(accountInfo(owner, Buffer.from("x")));
    const connection = { getAccountInfo } as unknown as Connection;
    const defi = new Defi(connection);

    const address = Keypair.generate().publicKey.toBase58();
    const result = await defi.getPoolsByAddress(address);
    expect(result.success).toBe(false);
    expect(result.message).toBe(`No parser available for program ${owner.toBase58()}`);
  });

  it("decodes a Raydium pool by address", async () => {
    const raydiumProgram = new PublicKey(RAYDIUM_AMM_V4_PROGRAM_ID);
    const getAccountInfo = vi
      .fn()
      .mockResolvedValue(accountInfo(raydiumProgram, buildRaydiumBuffer()));
    const connection = { getAccountInfo } as unknown as Connection;
    const defi = new Defi(connection);

    const address = Keypair.generate().publicKey.toBase58();
    const result = await defi.getPoolsByAddress(address);

    expect(result.success).toBe(true);
    expect(result.result?.dex).toBe("raydiumAmm");
    expect(result.result?.programId).toBe(RAYDIUM_AMM_V4_PROGRAM_ID);
  });
});

describe("Defi.getLiquidityDetails", () => {
  it("resolves both sides of the pair with metadata and vault amounts", async () => {
    const baseMint = Keypair.generate().publicKey;
    const quoteMint = Keypair.generate().publicKey;
    const baseVault = Keypair.generate().publicKey;
    const quoteVault = Keypair.generate().publicKey;
    const poolAddress = Keypair.generate().publicKey;
    const raydiumProgram = new PublicKey(RAYDIUM_AMM_V4_PROGRAM_ID);

    const mplTokenMetadata = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
    const metadataPda = (mint: PublicKey) =>
      PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), mplTokenMetadata.toBuffer(), mint.toBuffer()],
        mplTokenMetadata,
      )[0];

    const mintInfo = (decimals: number) => {
      const data = Buffer.alloc(45);
      data.writeUInt8(decimals, 44);
      return accountInfo(raydiumProgram, data);
    };
    const metaInfo = (name: string, symbol: string) => {
      const writeStr = (s: string) => {
        const b = Buffer.from(s, "utf8");
        const len = Buffer.alloc(4);
        len.writeUInt32LE(b.length);
        return Buffer.concat([len, b]);
      };
      const data = Buffer.concat([
        Buffer.alloc(65),
        writeStr(name),
        writeStr(symbol),
        writeStr("uri"),
      ]);
      return accountInfo(mplTokenMetadata, data);
    };

    const getAccountInfo = vi.fn().mockImplementation(async (pubkey: PublicKey) => {
      if (pubkey.equals(poolAddress)) {
        return accountInfo(
          raydiumProgram,
          buildRaydiumBuffer({ baseMint, quoteMint, baseVault, quoteVault }),
        );
      }
      if (pubkey.equals(baseMint)) return mintInfo(9);
      if (pubkey.equals(quoteMint)) return mintInfo(6);
      if (pubkey.equals(metadataPda(baseMint))) return metaInfo("Base Token", "BASE");
      if (pubkey.equals(metadataPda(quoteMint))) return metaInfo("Quote Token", "QUOTE");
      return null;
    });
    const getTokenAccountBalance = vi.fn().mockImplementation(async (pubkey: PublicKey) => {
      if (pubkey.equals(baseVault)) return { value: { amount: "1000" } };
      if (pubkey.equals(quoteVault)) return { value: { amount: "2000" } };
      throw new Error("unknown vault");
    });

    const connection = { getAccountInfo, getTokenAccountBalance } as unknown as Connection;
    const defi = new Defi(connection);

    const result = await defi.getLiquidityDetails(poolAddress.toBase58());

    expect(result.success).toBe(true);
    expect(result.result?.liquidity.tokenA).toEqual({
      address: baseMint.toBase58(),
      name: "Base Token",
      symbol: "BASE",
      decimals: 9,
      imageUri: "uri",
      amount: 1000,
    });
    expect(result.result?.liquidity.tokenB).toEqual({
      address: quoteMint.toBase58(),
      name: "Quote Token",
      symbol: "QUOTE",
      decimals: 6,
      imageUri: "uri",
      amount: 2000,
    });
  });

  it("skips the metadata fetch when includeMetadata is false", async () => {
    const baseMint = Keypair.generate().publicKey;
    const quoteMint = Keypair.generate().publicKey;
    const poolAddress = Keypair.generate().publicKey;
    const raydiumProgram = new PublicKey(RAYDIUM_AMM_V4_PROGRAM_ID);

    const mintInfo = (decimals: number) => {
      const data = Buffer.alloc(45);
      data.writeUInt8(decimals, 44);
      return accountInfo(raydiumProgram, data);
    };

    const getAccountInfo = vi.fn().mockImplementation(async (pubkey: PublicKey) => {
      if (pubkey.equals(poolAddress)) {
        return accountInfo(raydiumProgram, buildRaydiumBuffer({ baseMint, quoteMint }));
      }
      if (pubkey.equals(baseMint)) return mintInfo(9);
      if (pubkey.equals(quoteMint)) return mintInfo(6);
      return null;
    });
    const connection = { getAccountInfo } as unknown as Connection;
    const defi = new Defi(connection);

    const result = await defi.getLiquidityDetails(poolAddress.toBase58(), {
      includeMetadata: false,
    });

    expect(result.success).toBe(true);
    expect(result.result?.liquidity.tokenA).toEqual({
      address: baseMint.toBase58(),
      decimals: 9,
      amount: null, // no vault field set on this pool
    });
  });

  it("fails gracefully when a mint account can't be resolved", async () => {
    const baseMint = Keypair.generate().publicKey;
    const quoteMint = Keypair.generate().publicKey;
    const poolAddress = Keypair.generate().publicKey;
    const raydiumProgram = new PublicKey(RAYDIUM_AMM_V4_PROGRAM_ID);

    const getAccountInfo = vi.fn().mockImplementation(async (pubkey: PublicKey) => {
      if (pubkey.equals(poolAddress)) {
        return accountInfo(raydiumProgram, buildRaydiumBuffer({ baseMint, quoteMint }));
      }
      return null; // mint accounts unresolvable
    });
    const connection = { getAccountInfo } as unknown as Connection;
    const defi = new Defi(connection).enableLogging(false);

    const result = await defi.getLiquidityDetails(poolAddress.toBase58());
    expect(result).toEqual({
      success: false,
      message: `Failed to fetch token details for pool ${poolAddress.toBase58()}`,
    });
  });

  it("reports an unknown DEX when the owning program has no offsets registered", async () => {
    const poolAddress = Keypair.generate().publicKey;
    const owner = Keypair.generate().publicKey;

    const getAccountInfo = vi.fn().mockResolvedValue(accountInfo(owner, Buffer.from("x")));
    const connection = { getAccountInfo } as unknown as Connection;

    const fakeParser = {
      hasParser: vi.fn().mockReturnValue(true),
      parseAccount: vi.fn().mockReturnValue({
        parsed: { accountName: "Unknown", parsed: {} },
      }),
    } as unknown as Parser;

    const defi = new Defi(connection).addParser(fakeParser);
    const result = await defi.getLiquidityDetails(poolAddress.toBase58());

    expect(result).toEqual({
      success: false,
      message: `Unknown DEX for program ${owner.toBase58()}`,
    });
  });
});

describe("Defi chaining", () => {
  it("addParser and enableLogging return `this`", () => {
    const connection = {} as unknown as Connection;
    const defi = new Defi(connection);
    const fakeParser = {} as unknown as Parser;

    expect(defi.addParser(fakeParser)).toBe(defi);
    expect(defi.enableLogging(false)).toBe(defi);
  });
});
