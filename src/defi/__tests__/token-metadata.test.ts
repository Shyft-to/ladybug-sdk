import { describe, expect, it, vi } from "vitest";
import { Connection, PublicKey } from "@solana/web3.js";

import {
  getMintDecimals,
  getToken,
  getTokenAccountAmount,
} from "../utils/token-metadata";

const MPL_TOKEN_METADATA = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
);
const MINT = "So11111111111111111111111111111111111111112";

function metadataPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), MPL_TOKEN_METADATA.toBuffer(), mint.toBuffer()],
    MPL_TOKEN_METADATA,
  );
  return pda;
}

function mintAccountInfo(decimals: number) {
  const data = Buffer.alloc(45);
  data.writeUInt8(decimals, 44);
  return { data, owner: new PublicKey(MINT), lamports: 1, executable: false, rentEpoch: 0 };
}

function metadataAccountInfo(name: string, symbol: string, uri: string) {
  const writeString = (s: string) => {
    const strBuf = Buffer.from(s, "utf8");
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32LE(strBuf.length);
    return Buffer.concat([lenBuf, strBuf]);
  };
  const data = Buffer.concat([
    Buffer.alloc(1 + 32 + 32), // key + updateAuthority + mint
    writeString(name),
    writeString(symbol),
    writeString(uri),
  ]);
  return { data, owner: MPL_TOKEN_METADATA, lamports: 1, executable: false, rentEpoch: 0 };
}

function fakeConnection(getAccountInfo: ReturnType<typeof vi.fn>): Connection {
  return { getAccountInfo } as unknown as Connection;
}

describe("getMintDecimals", () => {
  it("reads decimals from byte offset 44", async () => {
    const getAccountInfo = vi.fn().mockResolvedValue(mintAccountInfo(6));
    const decimals = await getMintDecimals(fakeConnection(getAccountInfo), new PublicKey(MINT));
    expect(decimals).toBe(6);
  });

  it("throws when the mint account is missing", async () => {
    const getAccountInfo = vi.fn().mockResolvedValue(null);
    await expect(
      getMintDecimals(fakeConnection(getAccountInfo), new PublicKey(MINT)),
    ).rejects.toThrow(`mint account not found: ${MINT}`);
  });
});

describe("getTokenAccountAmount", () => {
  it("returns the raw token amount", async () => {
    const getTokenAccountBalance = vi
      .fn()
      .mockResolvedValue({ value: { amount: "12345" } });
    const connection = { getTokenAccountBalance } as unknown as Connection;

    const amount = await getTokenAccountAmount(connection, MINT);
    expect(amount).toBe(12345);
  });

  it("returns null when the balance can't be read", async () => {
    const getTokenAccountBalance = vi.fn().mockRejectedValue(new Error("not a token account"));
    const connection = { getTokenAccountBalance } as unknown as Connection;

    const amount = await getTokenAccountAmount(connection, MINT);
    expect(amount).toBeNull();
  });
});

describe("getToken", () => {
  it("returns decimals plus Metaplex name/symbol/uri when metadata exists", async () => {
    const mintPubkey = new PublicKey(MINT);
    const pda = metadataPda(mintPubkey);

    const getAccountInfo = vi.fn().mockImplementation(async (pubkey: PublicKey) => {
      if (pubkey.equals(mintPubkey)) return mintAccountInfo(9);
      if (pubkey.equals(pda)) return metadataAccountInfo("Wrapped SOL", "WSOL", "ipfs://uri");
      return null;
    });

    const token = await getToken(fakeConnection(getAccountInfo), MINT);

    expect(token).toEqual({
      address: MINT,
      name: "Wrapped SOL",
      symbol: "WSOL",
      decimals: 9,
      logoURI: "ipfs://uri",
    });
  });

  it("degrades to Unknown Token when metadata is missing, keeping real decimals", async () => {
    const mintPubkey = new PublicKey(MINT);
    const getAccountInfo = vi.fn().mockImplementation(async (pubkey: PublicKey) => {
      if (pubkey.equals(mintPubkey)) return mintAccountInfo(9);
      return null; // metadata PDA not found
    });

    const token = await getToken(fakeConnection(getAccountInfo), MINT);

    expect(token).toEqual({
      address: MINT,
      name: "Unknown Token",
      symbol: "UNKNOWN",
      decimals: 9,
      logoURI: "",
    });
  });

  it("throws when the mint account itself is missing", async () => {
    const getAccountInfo = vi.fn().mockResolvedValue(null);
    await expect(getToken(fakeConnection(getAccountInfo), MINT)).rejects.toThrow(
      `mint account not found: ${MINT}`,
    );
  });
});
