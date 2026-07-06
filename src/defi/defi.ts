import { Connection } from "@solana/web3.js";

import { getRawAccountsByMintOffsets } from "./gpa";
import { DEFAULT_DEX_OFFSETS } from "./constants";
import { RawDexPools } from "./types";

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
