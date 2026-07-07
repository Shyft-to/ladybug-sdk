/**
 * A single Solana `getProgramAccounts` memcmp filter.
 * Matches accounts whose bytes at `offset` equal the base58-encoded `bytes`.
 */
export type MemcmpFilter = { memcmp: { offset: number; bytes: string } };

/** A raw, undecoded pool account as returned by `getProgramAccounts`. */
export interface RawPoolAccount {
  /** The pool account address. */
  pubkey: string;
  /** The program that owns the account. */
  owner: string;
  /** Account balance in lamports. */
  lamports: number;
  /** Length of the raw account data in bytes. */
  dataLength: number;
  /** The raw account data, base64-encoded (undecoded). */
  dataBase64: string;
}

/** Raw pools discovered for a single DEX, before any decoding. */
export interface RawDexPools {
  /** Response key for this DEX (e.g. "raydiumAmm"). */
  name: string;
  /** The on-chain program that owns the pool accounts. */
  programId: string;
  /** The matching pool accounts, still as raw bytes. */
  pools: RawPoolAccount[];
}

/** How a pool account was decoded. */
export type DecodeMethod =
  /** Decoded via a registered IDL through the attached {@link Parser}. */
  | "idl"
  /** Decoded via a hand-written static struct (e.g. Raydium AMM V4). */
  | "static"
  /** Not decoded — no parser/decoder available; `data` is the base64 string. */
  | "raw";

/** A pool account after the decode pass. */
export interface DecodedPoolAccount {
  /** The pool account address. */
  pubkey: string;
  /** The program that owns the account. */
  owner: string;
  /** Account balance in lamports. */
  lamports: number;
  /** Length of the raw account data in bytes. */
  dataLength: number;
  /** How `data` was produced. */
  decodedBy: DecodeMethod;
  /**
   * The decoded pool state, or — when `decodedBy` is `"raw"` — the original
   * base64-encoded account data.
   */
  data: unknown;
}

/** Decoded pools for a single DEX. */
export interface DecodedDexPools {
  /** Response key for this DEX (e.g. "raydiumAmm"). */
  name: string;
  /** The on-chain program that owns the pool accounts. */
  programId: string;
  /** The matching pool accounts, decoded where possible. */
  pools: DecodedPoolAccount[];
}
