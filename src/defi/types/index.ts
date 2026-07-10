import { TokenInfo } from "../utils/token-metadata";

export type { TokenInfo };

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

/** One side of a pool's liquidity pair: token metadata plus the pooled amount. */
export interface LiquidityToken {
  /** The token mint address. */
  address: string;
  /** Token name from Metaplex metadata, or "Unknown Token" if unavailable. */
  name: string;
  /** Token symbol from Metaplex metadata, or "UNKNOWN" if unavailable. */
  symbol: string;
  /** Mint decimals. */
  decimals: number;
  /** Metadata image/URI, or "" if unavailable. */
  imageUri: string;
  /**
   * Raw token amount (in base units) held in the pool's vault, or `null` when
   * the vault balance can't be read (e.g. Meteora DAMM V1 vault-program accounts).
   */
  amount: number | null;
}

/** Result of looking up a pool's liquidity pair and token details by address. */
export interface LiquidityDetailsResult {
  /** Whether the pool and its token details were resolved. */
  success: boolean;
  /** Human-readable status message. */
  message: string;
  /** Present only when `success` is true. */
  result?: {
    /** The pool account address. */
    address: string;
    /** The DEX this pool belongs to (e.g. "orcaWhirlpool"). */
    dex: string;
    /** The on-chain program that owns the pool account. */
    programId: string;
    /** The two sides of the pool's liquidity pair. */
    liquidity: {
      /** The first token in the pair. */
      tokenA: LiquidityToken;
      /** The second token in the pair. */
      tokenB: LiquidityToken;
    };
  };
}

/** Result of looking up and decoding a single pool by its account address. */
export interface PoolByAddressResult {
  /** Whether the pool was found and decoded. */
  success: boolean;
  /** Human-readable status message. */
  message: string;
  /** Present only when `success` is true. */
  result?: {
    /** The DEX this pool belongs to (e.g. "orcaWhirlpool"). */
    dex: string;
    /** The on-chain program that owns the pool account. */
    programId: string;
    /** The decoded pool state. */
    poolInfo: unknown;
  };
}
