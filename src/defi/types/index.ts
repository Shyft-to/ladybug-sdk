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

/**
 * A decoded pool account as returned to SDK consumers: decoded on-chain
 * fields are spread directly at the top level (no `data` wrapper), alongside
 * the account's address, balance, and fetch timestamp.
 *
 * `owner`/`dataLength`/`decodedBy` are omitted — `owner` is redundant with the
 * enclosing DEX's `programId`, and the other two are internal decode-routing
 * bookkeeping (see {@link DecodedPoolAccount}), not part of the public shape.
 * When no decoder was available for the pool's program, the decoded fields
 * fall back to a single `data` key holding the raw base64 account data.
 */
export interface PoolResult {
  /** The pool account address. */
  pubkey: string;
  /** Account balance in lamports. */
  lamports: number;
  /** Decoded pool fields (or `data`, the raw base64, when undecoded). */
  [field: string]: unknown;
}

/** One DEX's matching pools within a {@link PoolsFetchResult}. */
export interface DexPoolsResult {
  /** The matching pool accounts, decoded where possible. */
  pools: PoolResult[];
  /** The on-chain program that owns the pool accounts. */
  programId: string;
}

/** Result of a multi-DEX pool search ({@link Defi.getPoolsByTokenPair}, {@link Defi.getPoolsForToken}). */
export interface PoolsFetchResult {
  /** Whether the search completed. A failure in one DEX doesn't fail the whole search — see `dexes`. */
  success: boolean;
  /** Human-readable status message. */
  message: string;
  /** Present only when `success` is true. */
  result?: {
    /** Pools found, keyed by DEX name (e.g. "raydiumAmm"). */
    dexes: Record<string, DexPoolsResult>;
  };
}

/**
 * One side of a pool's liquidity pair without Metaplex metadata — just the
 * mint, its decimals, and the pooled amount. Returned when `getLiquidityDetails`
 * is called with `{ includeMetadata: false }`.
 */
export interface LiquidityAmount {
  /** The token mint address. */
  address: string;
  /** Mint decimals (from the SPL mint account). */
  decimals: number;
  /**
   * Raw token amount (in base units) held in the pool's vault, or `null` when
   * the vault balance can't be read (e.g. Meteora DAMM V1 vault-program accounts).
   */
  amount: number | null;
}

/**
 * One side of a pool's liquidity pair including Metaplex metadata. Returned by
 * `getLiquidityDetails` by default (`includeMetadata: true`).
 */
export interface LiquidityToken extends LiquidityAmount {
  /** Token name from Metaplex metadata, or "Unknown Token" if unavailable. */
  name: string;
  /** Token symbol from Metaplex metadata, or "UNKNOWN" if unavailable. */
  symbol: string;
  /** Metadata image/URI, or "" if unavailable. */
  imageUri: string;
}

/** Options for {@link Defi.getLiquidityDetails}. */
export interface GetLiquidityDetailsOptions {
  /**
   * Whether to fetch Metaplex metadata (name/symbol/imageUri) for each token.
   * When `false`, only `address`, `decimals`, and `amount` are returned, saving
   * a metadata RPC per token. Defaults to `true`.
   */
  includeMetadata?: boolean;
}

/**
 * Result of looking up a pool's liquidity pair and token details by address.
 * `T` is the per-token shape: {@link LiquidityToken} with metadata (default) or
 * {@link LiquidityAmount} without it.
 */
export interface LiquidityDetailsResult<T = LiquidityToken> {
  /** Whether the pool and its token details were resolved. */
  success: boolean;
  /** Human-readable status message. */
  message: string;
  /** Present only when `success` is true. */
  result?: {
    /** The pool account address. */
    address: string;
    /** The DEX this pool belongs to (e.g. "orca"). */
    dex: string;
    /** The on-chain program that owns the pool account. */
    programId: string;
    /** The two sides of the pool's liquidity pair. */
    liquidity: {
      /** The first token in the pair. */
      tokenA: T;
      /** The second token in the pair. */
      tokenB: T;
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
    /** The DEX this pool belongs to (e.g. "orca"). */
    dex: string;
    /** The on-chain program that owns the pool account. */
    programId: string;
    /** The decoded pool state. */
    poolInfo: unknown;
  };
}
