/**
 * Program IDs and pool-account mint offsets for every supported DEX.
 *
 * The offsets are the byte positions of the two token mints inside each DEX's
 * pool account layout, used to build the `getProgramAccounts` memcmp filters.
 */

// ─── Raydium AMM V4 ─────────────────────────────────────────────────────────
export const RAYDIUM_AMM_V4_PROGRAM_ID = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
export const RAYDIUM_AMM_V4_BASE_MINT_OFFSET = 400;
export const RAYDIUM_AMM_V4_QUOTE_MINT_OFFSET = 432;

// ─── Meteora DLMM ───────────────────────────────────────────────────────────
export const METEORA_DLMM_PROGRAM_ID = "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo";
export const METEORA_DLMM_TOKEN_X_MINT_OFFSET = 88;
export const METEORA_DLMM_TOKEN_Y_MINT_OFFSET = 120;

// ─── Meteora DAMM V1 ────────────────────────────────────────────────────────
export const METEORA_AMM_PROGRAM_ID = "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB";
export const METEORA_AMM_TOKEN_A_MINT_OFFSET = 40;
export const METEORA_AMM_TOKEN_B_MINT_OFFSET = 72;

// ─── Orca Whirlpool ─────────────────────────────────────────────────────────
export const ORCA_WHIRLPOOL_PROGRAM_ID = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
export const ORCA_WHIRLPOOL_TOKEN_A_MINT_OFFSET = 101;
export const ORCA_WHIRLPOOL_TOKEN_B_MINT_OFFSET = 181;

export const RAYDIUM_CLMM_PROGRAM_ID = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";
export const RAYDIUM_CLMM_TOKEN_MINT_0_OFFSET = 73;
export const RAYDIUM_CLMM_TOKEN_MINT_1_OFFSET = 105;

export const RAYDIUM_CPMM_PROGRAM_ID = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";
export const RAYDIUM_CPMM_TOKEN_MINT_0_OFFSET = 168;
export const RAYDIUM_CPMM_TOKEN_MINT_1_OFFSET = 200;

export const PUMP_AMM_PROGRAM_ID = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
export const PUMP_AMM_BASE_MINT_OFFSET = 43;
export const PUMP_AMM_QUOTE_MINT_OFFSET = 75;


// ─── Default offsets registry ───────────────────────────────────────────────

/** The known mint offsets (and IDL account name) for a DEX program. */
export interface DexOffsetDefaults {
  /** Response key used for this DEX. */
  name: string;
  /** Byte offset of the first token mint in the pool account. */
  offsetA: number;
  /** Byte offset of the second token mint in the pool account. */
  offsetB: number;
  /** IDL account struct to decode. Absent for hand-decoded DEXes (e.g. Raydium). */
  accountName?: string;
  /**
   * Field name of the first token mint in the *decoded* pool account. This
   * differs per DEX (e.g. `token_mint_a` for Orca, `baseMint` for Raydium),
   * so it's recorded here to locate the mints after decoding.
   */
  mintFieldA: string;
  /** Field name of the second token mint in the decoded pool account. */
  mintFieldB: string;
  /**
   * Field name of the first token's vault (the SPL token account holding the
   * reserve) in the decoded pool account, used to read the pooled `amount`.
   * Absent for DEXes whose vaults aren't plain token accounts (e.g. Meteora
   * DAMM V1, which uses Mercurial vault-program accounts).
   */
  vaultFieldA?: string;
  /** Field name of the second token's vault in the decoded pool account. */
  vaultFieldB?: string;
}

/**
 * Built-in defaults keyed by program id. When you register a known program via
 * {@link Defi.addIDL} / {@link Defi.addDecoder} without offsets,
 * these "accelerated" defaults are used automatically.
 */
export const DEFAULT_DEX_OFFSETS: Record<string, DexOffsetDefaults> = {
  [RAYDIUM_AMM_V4_PROGRAM_ID]: {
    name: "raydiumAmm",
    offsetA: RAYDIUM_AMM_V4_BASE_MINT_OFFSET,
    offsetB: RAYDIUM_AMM_V4_QUOTE_MINT_OFFSET,
    mintFieldA: "baseMint",
    mintFieldB: "quoteMint",
    vaultFieldA: "baseVault",
    vaultFieldB: "quoteVault",
  },
  [METEORA_DLMM_PROGRAM_ID]: {
    name: "meteoraDlmm",
    offsetA: METEORA_DLMM_TOKEN_X_MINT_OFFSET,
    offsetB: METEORA_DLMM_TOKEN_Y_MINT_OFFSET,
    accountName: "LbPair",
    mintFieldA: "token_x_mint",
    mintFieldB: "token_y_mint",
    vaultFieldA: "reserve_x",
    vaultFieldB: "reserve_y",
  },
  [METEORA_AMM_PROGRAM_ID]: {
    name: "meteoraAmm",
    offsetA: METEORA_AMM_TOKEN_A_MINT_OFFSET,
    offsetB: METEORA_AMM_TOKEN_B_MINT_OFFSET,
    accountName: "Pool",
    mintFieldA: "tokenAMint",
    mintFieldB: "tokenBMint",
    vaultFieldA: "aVault",
    vaultFieldB: "bVault",
    // aVault/bVault are Mercurial vault-program accounts, not token accounts,
    // so the pooled amount isn't a simple token-account balance here.
  },
  [ORCA_WHIRLPOOL_PROGRAM_ID]: {
    name: "orca",
    offsetA: ORCA_WHIRLPOOL_TOKEN_A_MINT_OFFSET,
    offsetB: ORCA_WHIRLPOOL_TOKEN_B_MINT_OFFSET,
    accountName: "Whirlpool",
    mintFieldA: "token_mint_a",
    mintFieldB: "token_mint_b",
    vaultFieldA: "token_vault_a",
    vaultFieldB: "token_vault_b",
  },
  [RAYDIUM_CLMM_PROGRAM_ID]: {
    name: "raydiumClmm",
    offsetA: RAYDIUM_CLMM_TOKEN_MINT_0_OFFSET,
    offsetB: RAYDIUM_CLMM_TOKEN_MINT_1_OFFSET,
    accountName: "PoolState",
    mintFieldA: "token_mint_0",
    mintFieldB: "token_mint_1",
    vaultFieldA: "token_vault_0",
    vaultFieldB: "token_vault_1",
  },
  [RAYDIUM_CPMM_PROGRAM_ID]: {
    name: "raydiumCpmm",
    offsetA: RAYDIUM_CPMM_TOKEN_MINT_0_OFFSET,
    offsetB: RAYDIUM_CPMM_TOKEN_MINT_1_OFFSET,
    accountName: "PoolState",
    mintFieldA: "token_0_mint",
    mintFieldB: "token_1_mint",
    vaultFieldA: "token_0_vault",
    vaultFieldB: "token_1_vault",
  },
  [PUMP_AMM_PROGRAM_ID]: {
    name: "pumpFunAmm",
    offsetA: PUMP_AMM_BASE_MINT_OFFSET,
    offsetB: PUMP_AMM_QUOTE_MINT_OFFSET,
    accountName: "Pool",
    mintFieldA: "base_mint",
    mintFieldB: "quote_mint",
    vaultFieldA: "pool_base_token_account",
    vaultFieldB: "pool_quote_token_account",
  }
};

/**
 * The friendly names of every DEX the SDK supports, in `DEFAULT_DEX_OFFSETS`
 * order. Use these to filter lookups (e.g. `getPoolsByTokenPair(baseMint, quoteMint, ["orca"])`)
 * and to validate/suggest names. Kept as a source of truth for {@link DexName}.
 */
export const SUPPORTED_DEX_NAMES = [
  "raydiumAmm",
  "meteoraDlmm",
  "meteoraAmm",
  "orca",
  "raydiumClmm",
  "raydiumCpmm",
  "pumpFunAmm",
] as const;

/** A supported DEX name (see {@link SUPPORTED_DEX_NAMES}). */
export type DexName = (typeof SUPPORTED_DEX_NAMES)[number];
