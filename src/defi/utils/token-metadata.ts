import { Connection, PublicKey } from "@solana/web3.js";

/** Metaplex Token Metadata program id. */
const MPL_TOKEN_METADATA = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
);
const METADATA_SEED = "metadata";

/** Basic on-chain token details for a mint. */
export interface TokenInfo {
  /** The token mint address. */
  address: string;
  /** Token name from Metaplex metadata, or "Unknown Token" if unavailable. */
  name: string;
  /** Token symbol from Metaplex metadata, or "UNKNOWN" if unavailable. */
  symbol: string;
  /** Mint decimals, read from the SPL mint account. */
  decimals: number;
  /** Metadata URI (json tag "logoURI"), or "" if unavailable. */
  logoURI: string;
}

/**
 * Derives the Metaplex metadata PDA for a mint.
 * seeds = ["metadata", metadataProgramId, mint].
 */
function findMetadataPda(mint: PublicKey): PublicKey {

  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(METADATA_SEED),
      MPL_TOKEN_METADATA.toBuffer(),
      mint.toBuffer(),
    ],
    MPL_TOKEN_METADATA,
  );
  return pda;
}

/**
 * Reads `decimals` from the SPL mint account.
 * SPL Mint layout: mintAuthorityOption(4) + mintAuthority(32) + supply(8) = 44,
 * so `decimals` (u8) sits at byte offset 44.
 */
async function getMintDecimals(
  connection: Connection,
  mintPubkey: PublicKey,
): Promise<number> {
  const info = await connection.getAccountInfo(mintPubkey);
  if (!info) {
    throw new Error(`mint account not found: ${mintPubkey.toBase58()}`);
  }
  return info.data.readUInt8(44); //from SPL Token Mint Layout
}

/**
 * Borsh-decodes the Metaplex metadata account.
 * Metadata layout: key(1) + updateAuthority(32) + mint(32) = 65 bytes,
 * then borsh strings: name, symbol, uri (each = u32 length prefix + bytes).
 */
async function getTokenMetadata(
  connection: Connection,
  mintPubkey: PublicKey,
): Promise<{ name: string; symbol: string; uri: string }> {
  
  const metadataPda = findMetadataPda(mintPubkey);
  const info = await connection.getAccountInfo(metadataPda);
  if (!info) {
    throw new Error(`metadata account not found: ${metadataPda.toBase58()}`);
  }

  const data = info.data;
  
  let offset = 1 + 32 + 32; // skipping the following: key(1b), updateAuthority(32b), mint(32b)
  const readBorshString = (): string => {
    const len = data.readUInt32LE(offset);
    offset += 4;
    // Metaplex pads strings with trailing \0 — strip them.
    const str = data
      .subarray(offset, offset + len)
      .toString("utf8")
      .replace(/\0/g, "");
    offset += len;
    return str;
  };

  const name = readBorshString();
  const symbol = readBorshString(); //offset incremented inside
  const uri = readBorshString(); //offset incremented inside
  return { name, symbol, uri };
}

/**
 * Reads the token `amount` (raw, in base units) held by an SPL token account,
 * e.g. a pool's reserve vault. Returns `null` if the account is missing or is
 * not a plain token account (e.g. a Mercurial vault-program account).
 *
 * @param connection - A Solana `Connection`.
 * @param vaultAddress - The token account address to read the balance of.
 * @returns The raw token amount, or `null` if it can't be read as a token account.
 */
export async function getTokenAccountAmount(
  connection: Connection,
  vaultAddress: string,
): Promise<number | null> {
  try {
    const res = await connection.getTokenAccountBalance(
      new PublicKey(vaultAddress),
    );
    return Number(res.value.amount);
  } catch {
    return null;
  }
}

/**
 * Fetches token details for a mint: decimals (from the SPL mint account) plus
 * name/symbol/uri (from the Metaplex metadata account). If the metadata fetch
 * or decode fails, degrades gracefully to "Unknown Token" / "UNKNOWN" while
 * keeping the real decimals.
 *
 * @param connection - A Solana `Connection`.
 * @param mintAddress - The token mint address.
 * @returns The token's {@link TokenInfo}.
 * @throws If the mint account itself is missing (decimals are required).
 */
export async function getToken(
  connection: Connection,
  mintAddress: string,
): Promise<TokenInfo> {
  const mintPubkey = new PublicKey(mintAddress);

  // Decimals must succeed — it's the source of truth for the mint.
  const decimals = await getMintDecimals(connection, mintPubkey);

  try {
    const { name, symbol, uri } = await getTokenMetadata(connection, mintPubkey);
    return { address: mintAddress, name, symbol, decimals, logoURI: uri };
  } catch {
    return {
      address: mintAddress,
      name: "Unknown Token",
      symbol: "UNKNOWN",
      decimals,
      logoURI: "",
    };
  }
}
