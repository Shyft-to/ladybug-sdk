import { Connection, PublicKey } from "@solana/web3.js";

import { getRawAccountsByMintOffsets } from "./gpa";
import { DEFAULT_DEX_OFFSETS, RAYDIUM_AMM_V4_PROGRAM_ID } from "./constants";
import { decodeLiquidityStateV4 } from "./decoders/raydium-liquidity-state-v4";
import {
  DecodedDexPools,
  DecodedPoolAccount,
  LiquidityDetailsResult,
  LiquidityToken,
  PoolByAddressResult,
  RawDexPools,
  RawPoolAccount,
} from "./types";
import { getToken, getTokenAccountAmount } from "./utils/token-metadata";
import { Parser } from "../parsers/parser";

/**
 * Discovers on-chain liquidity pools across Solana DEXes by querying
 * `getProgramAccounts` with memcmp filters on the pools' token-mint offsets.
 *
 * Every DEX whose mint offsets the SDK knows (see `DEFAULT_DEX_OFFSETS`) is
 * queried automatically — no registration required. Results are returned as
 * **raw, undecoded** account data; decode the `dataBase64` yourself.
 *
 * ```ts
 * const defi = new Defi(connection); // or new Defi(rpcUrl)
 *
 * // Pools for a specific pair:
 * const pairs = await defi.getPoolByTokenPair(baseMint, quoteMint);
 *
 * // Every pool holding a single token:
 * const pools = await defi.getPoolsForToken(mint);
 * ```
 */
export class Defi {
  private connection: Connection;
  private enableLogs: boolean = true;
  private parser?: Parser;


  /**
   * @param connection - A Solana `Connection`, or an RPC endpoint URL from
   * which one is created. The RPC should support `getProgramAccounts` with
   * memcmp filters.
   */
  constructor(connection: Connection | string) {
    this.connection =
      typeof connection === "string" ? new Connection(connection) : connection;
  }

  /**
   * Attaches a {@link Parser} used by the decoded fetch methods
   * ({@link getDecodedPoolByTokenPair}, {@link getDecodedPoolsForToken}).
   * Pools owned by a program whose IDL is registered on the parser are decoded
   * via that IDL; pools with no registered IDL (and no built-in static decoder)
   * are returned raw.
   *
   * @param parser - A `Parser` with the DEX IDLs you want decoded already added.
   * @returns `this`, for chaining.
   */
  addParser(parser: Parser): this {
    this.parser = parser;
    return this;
  }

  /**
   * Finds pools for a token pair across every DEX whose mint offsets the SDK
   * knows (see `DEFAULT_DEX_OFFSETS`), returning the **raw, undecoded** account
   * data. No layout decoding — decode the returned `dataBase64` yourself.
   *
   * @param baseMint - One mint of the pair.
   * @param quoteMint - The other mint of the pair.
   * @returns One entry per known DEX, each with its raw matching pool accounts.
   */
  async getPoolByTokenPair(
    baseMint: string,
    quoteMint: string,
  ): Promise<RawDexPools[]> {
    return this.fetchAcrossDexes(baseMint, quoteMint);
  }

  /**
   * Finds every pool holding `mint` (in either mint slot) across every DEX
   * whose mint offsets the SDK knows, returning the **raw, undecoded** account
   * data.
   *
   * @param mint - The token mint to search for.
   * @returns One entry per known DEX, each with its raw matching pool accounts.
   */
  async getPoolsForToken(mint: string): Promise<RawDexPools[]> {
    return this.fetchAcrossDexes(mint);
  }

  /**
   * Like {@link getPoolByTokenPair}, but decodes each pool account. Requires a
   * parser attached via {@link addParser} for IDL-based decoding. Raydium AMM V4
   * is always decoded via its built-in static struct; programs with no
   * registered IDL are returned raw.
   *
   * @param baseMint - One mint of the pair.
   * @param quoteMint - The other mint of the pair.
   * @returns One entry per known DEX, each with its decoded pool accounts.
   */
  async getDecodedPoolByTokenPair(
    baseMint: string,
    quoteMint: string,
  ): Promise<DecodedDexPools[]> {
    const raw = await this.fetchAcrossDexes(baseMint, quoteMint);
    return raw.map((dex) => this.decodeDexPools(dex));
  }

  /**
   * Like {@link getPoolsForToken}, but decodes each pool account. Requires a
   * parser attached via {@link addParser} for IDL-based decoding. Raydium AMM V4
   * is always decoded via its built-in static struct; programs with no
   * registered IDL are returned raw.
   *
   * @param mint - The token mint to search for.
   * @returns One entry per known DEX, each with its decoded pool accounts.
   */
  async getDecodedPoolsForToken(mint: string): Promise<DecodedDexPools[]> {
    const raw = await this.fetchAcrossDexes(mint);
    return raw.map((dex) => this.decodeDexPools(dex));
  }

  /**
   * Fetches a single pool account by its address, resolves the owning DEX from
   * the account's owner, and decodes it. Raydium AMM V4 is decoded via its
   * built-in static struct; other programs need their IDL registered on a
   * parser attached via {@link addParser}.
   *
   * @param address - The pool account address.
   * @returns A `{ success, message, result? }` envelope; `result` (with `dex`,
   * `programId`, and decoded `poolInfo`) is present only on success.
   */
  async getPoolsByAddress(address: string): Promise<PoolByAddressResult> {
    const resolved = await this.decodeAccountByAddress(address);
    if (!resolved.ok) {
      return { success: false, message: resolved.message };
    }

    return {
      success: true,
      message: "Pool fetched successfully",
      result: {
        dex: DEFAULT_DEX_OFFSETS[resolved.programId]?.name ?? "unknown",
        programId: resolved.programId,
        poolInfo: resolved.decoded.data,
      },
    };
  }

  /**
   * Fetches a pool by address, decodes it, resolves the two token mints and
   * reserve vaults (whose field names differ per DEX, see `DEFAULT_DEX_OFFSETS`),
   * and builds the liquidity pair: on-chain token details (decimals + Metaplex
   * metadata) plus the pooled `amount` for each side. Requires the owning
   * program to be decodable — Raydium AMM V4 via its static struct, others via
   * an IDL registered on a parser attached with {@link addParser}.
   *
   * @param address - The pool account address.
   * @returns A `{ success, message, result? }` envelope; `result` (with
   * `address`, `dex`, `programId`, and `liquidity.tokenA`/`tokenB`) is present
   * only on success.
   */
  async getLiquidityDetails(address: string): Promise<LiquidityDetailsResult> {
    const resolved = await this.decodeAccountByAddress(address);
    if (!resolved.ok) {
      return { success: false, message: resolved.message };
    }

    const def = DEFAULT_DEX_OFFSETS[resolved.programId];
    if (!def) {
      return {
        success: false,
        message: `Unknown DEX for program ${resolved.programId}`,
      };
    }

    const fields = this.extractParsedFields(resolved.decoded);

    const mintA = fields[def.mintFieldA];
    const mintB = fields[def.mintFieldB];
    if (typeof mintA !== "string" || typeof mintB !== "string") {
      return {
        success: false,
        message: `Could not resolve token mints for pool ${address}`,
      };
    }

    const vaultA =
      def.vaultFieldA && typeof fields[def.vaultFieldA] === "string"
        ? (fields[def.vaultFieldA] as string)
        : undefined;
    const vaultB =
      def.vaultFieldB && typeof fields[def.vaultFieldB] === "string"
        ? (fields[def.vaultFieldB] as string)
        : undefined;

    try {
      const [tokenA, tokenB] = await Promise.all([
        this.buildLiquidityToken(mintA, vaultA),
        this.buildLiquidityToken(mintB, vaultB),
      ]);

      return {
        success: true,
        message: "Liquidity fetched successfully",
        result: {
          address,
          dex: def.name,
          programId: resolved.programId,
          liquidity: { tokenA, tokenB },
        },
      };
    } catch (error) {
      if (this.enableLogs)
        console.error(`Failed to fetch token details for pool ${address}`, error);
      return {
        success: false,
        message: `Failed to fetch token details for pool ${address}`,
      };
    }
  }

  /**
   * Builds one side of a liquidity pair: token metadata + decimals for `mint`,
   * plus the pooled `amount` read from `vault` (null when no vault is known or
   * its balance can't be read).
   */
  private async buildLiquidityToken(
    mint: string,
    vault: string | undefined,
  ): Promise<LiquidityToken> {

    console.log("Mint: ", mint);
    console.log("Vault: ", vault);

    const [token, amount] = await Promise.all([
      getToken(this.connection, mint),
      vault ? getTokenAccountAmount(this.connection, vault) : Promise.resolve(null), //calls token account 
    ]);

    return {
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      imageUri: token.logoURI,
      amount,
    };
  }

  /**
   * Shared lookup for the by-address methods: validates the address, fetches the
   * account, resolves the owning program, and decodes it (Raydium static struct,
   * or the attached parser's IDL). Returns a discriminated result rather than
   * throwing.
   */
  private async decodeAccountByAddress(
    address: string,
  ): Promise<
    | { ok: false; message: string }
    | { ok: true; programId: string; decoded: DecodedPoolAccount }
  > {
    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(address);
    } catch {
      return { ok: false, message: `Invalid address: ${address}` };
    }

    try {
      const info = await this.connection.getAccountInfo(pubkey);
      if (!info) {
        return { ok: false, message: `No account found for ${address}` };
      }

      const programId = info.owner.toBase58();
      const isRaydium = programId === RAYDIUM_AMM_V4_PROGRAM_ID;
      const hasIdl = this.parser?.hasParser(programId) ?? false;

      if (!isRaydium && !hasIdl) {
        return {
          ok: false,
          message: `No parser available for program ${programId}`,
        };
      }

      const raw: RawPoolAccount = {
        pubkey: address,
        owner: programId,
        lamports: info.lamports,
        dataLength: info.data.length,
        dataBase64: info.data.toString("base64"),
      };
      const decoded = this.decodePool(raw, isRaydium, hasIdl);

      if (decoded.decodedBy === "raw") {
        return { ok: false, message: `Failed to decode pool ${address}` };
      }

      return { ok: true, programId, decoded };
    } catch (error) {
      if (this.enableLogs)
        console.error(`Failed to fetch pool ${address}`, error);
      return { ok: false, message: `Failed to fetch pool ${address}` };
    }
  }

  /**
   * Returns the flat decoded field map for a pool, unwrapping the
   * `{ accountName, parsed }` shape produced by the IDL path so callers can read
   * fields uniformly across IDL- and static-decoded pools.
   */
  private extractParsedFields(
    decoded: DecodedPoolAccount,
  ): Record<string, unknown> {
    if (decoded.decodedBy === "idl") {
      const data = decoded.data as { parsed?: Record<string, unknown> };
      return data.parsed ?? {};
    }
    return decoded.data as Record<string, unknown>;
  }

  /**
   * Decodes a single DEX's raw pools, routing each account by owning program:
   * Raydium AMM V4 → static struct; a program whose IDL is registered on the
   * attached parser → IDL decode; anything else → raw base64. Failures fall
   * back to raw rather than throwing.
   */
  private decodeDexPools(dex: RawDexPools): DecodedDexPools {
    const isRaydium = dex.programId === RAYDIUM_AMM_V4_PROGRAM_ID;
    const hasIdl = this.parser?.hasParser(dex.programId) ?? false;

    const pools = dex.pools.map((pool): DecodedPoolAccount =>
      this.decodePool(pool, isRaydium, hasIdl),
    );

    return { name: dex.name, programId: dex.programId, pools };
  }

  /** Decodes one raw pool account, falling back to raw on any failure. */
  private decodePool(
    pool: RawPoolAccount,
    isRaydium: boolean,
    hasIdl: boolean,
  ): DecodedPoolAccount {
    const base = {
      pubkey: pool.pubkey,
      owner: pool.owner,
      lamports: pool.lamports,
      dataLength: pool.dataLength,
    };

    if (isRaydium) {
      try {
        const buffer = Buffer.from(pool.dataBase64, "base64");
        return { ...base, decodedBy: "static", data: decodeLiquidityStateV4(buffer) };
      } catch (error) {
        if (this.enableLogs)
          console.error(`Failed to decode Raydium pool ${pool.pubkey}`, error);
        return { ...base, decodedBy: "raw", data: pool.dataBase64 };
      }
    }

    if (this.parser && hasIdl) {
      try {
        const parsed = this.parser.parseAccount({
          slot: 0,
          pubkey: new PublicKey(pool.pubkey),
          owner: new PublicKey(pool.owner),
          lamports: pool.lamports,
          data: Buffer.from(pool.dataBase64, "base64"),
          executable: false,
        });
        return { ...base, decodedBy: "idl", data: parsed.parsed };
      } catch (error) {
        if (this.enableLogs)
          console.error(`Failed to decode pool ${pool.pubkey}`, error);
        return { ...base, decodedBy: "raw", data: pool.dataBase64 };
      }
    }

    return { ...base, decodedBy: "raw", data: pool.dataBase64 };
  }

  /**
   * Runs the shared GPA lookup ({@link getRawAccountsByMintOffsets}) against
   * every known DEX in parallel and shapes the raw accounts per DEX. A failure
   * in one DEX yields an empty list for that DEX rather than failing the whole
   * request. Pass both mints for a pair, or one mint to match either slot.
   */
  private async fetchAcrossDexes(
    mintA?: string,
    mintB?: string,
  ): Promise<RawDexPools[]> {
    const dexes = Object.entries(DEFAULT_DEX_OFFSETS);
    return Promise.all(
      dexes.map(async ([programId, def]): Promise<RawDexPools> => {
        try {
          const pools = await getRawAccountsByMintOffsets(
            this.connection,
            programId,
            def.offsetA,
            def.offsetB,
            mintA,
            mintB,
          );
          return { name: def.name, programId, pools };
        } catch (error) {
          if (this.enableLogs)
            console.error(`Failed to fetch ${def.name} pools`, error);
          return { name: def.name, programId, pools: [] };
        }
      }),
    );
  }

  /**
   * Enables or disables logging for the fetcher. Enabled by default.
   * When enabled, fetch failures are logged to the console.
   * @param enable - Whether to enable or disable logging.
   * @returns `this`, for chaining.
   */
  enableLogging(enable: boolean): this {
    this.enableLogs = enable;
    return this;
  }
}
