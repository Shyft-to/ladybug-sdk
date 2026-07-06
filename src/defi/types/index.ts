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
