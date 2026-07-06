import { Idl } from "@coral-xyz/anchor";
import { createHash } from "crypto";

/**
 * Recursively normalizes serum-style IDL nodes into the modern coral form that
 * `@coral-xyz/anchor` expects:
 *  - `{ defined: "CurveType" }`  ->  `{ defined: { name: "CurveType" } }`
 *  - the primitive type name `"publicKey"`  ->  `"pubkey"`
 *
 * The `"publicKey"` rewrite is skipped for values under a `name` key so that an
 * identifier literally named "publicKey" would not be corrupted.
 *
 * @param node - The IDL node to normalize.
 * @param key - The key this node was reached through (used to guard `name`).
 */
function normalizeNode(node: any, key?: string): any {
  if (typeof node === "string") {
    return key !== "name" && node === "publicKey" ? "pubkey" : node;
  }
  if (Array.isArray(node)) return node.map((child) => normalizeNode(child, key));
  if (node && typeof node === "object") {
    const out: any = {};
    for (const [k, value] of Object.entries(node)) {
      if (k === "defined" && typeof value === "string") {
        out[k] = { name: value };
      } else {
        out[k] = normalizeNode(value, k);
      }
    }
    return out;
  }
  return node;
}

/**
 * Computes the 8-byte Anchor account discriminator (`sha256("account:<Name>")`).
 * The coral accounts coder needs a discriminator on every account entry — it
 * uses its length to strip the prefix before decoding.
 */
function accountDiscriminator(name: string): number[] {
  return Array.from(
    createHash("sha256").update(`account:${name}`).digest().subarray(0, 8),
  );
}

/**
 * Detects whether an IDL is already in modern coral (`@coral-xyz/anchor`) form.
 * Mirrors the heuristic used by the `Parser` class.
 */
export function isCoralIdl(idl: any): boolean {
  return (
    "address" in idl ||
    ("instructions" in idl &&
      Array.isArray(idl.instructions) &&
      idl.instructions.length > 0 &&
      "discriminator" in idl.instructions[0])
  );
}

/**
 * Converts a legacy (`@project-serum`-style) IDL into a modern Anchor
 * (`@coral-xyz`) IDL so it can be used with the current `BorshAccountsCoder`.
 *
 * Handles the differences that matter for account decoding:
 *  - `{ defined: "X" }` refs become `{ defined: { name: "X" } }`
 *  - old `isMut`/`isSigner` account flags map to `writable`/`signer`
 *  - account structs are lifted into `types` (the coral coder resolves account
 *    layouts by name from `idl.types`, ignoring inline `account.type`)
 *  - each account gets an 8-byte discriminator
 *  - a `metadata` block with the program address is added
 *
 * @param oldIdl - The legacy IDL object.
 * @param programAddress - The on-chain address of the program the IDL describes.
 * @returns A modern Anchor-compatible IDL.
 */
export function transformLegacyIdl(oldIdl: any, programAddress: string): Idl {
  // The coral accounts coder resolves each account's layout by looking up a
  // typedef of the same name in `idl.types`, so lift account structs in there.
  const accountTypeDefs = (oldIdl.accounts || []).map((acc: any) => ({
    name: acc.name,
    type: acc.type,
  }));

  const seen = new Set<string>();
  const types = [...(oldIdl.types || []), ...accountTypeDefs].filter((t: any) => {
    if (seen.has(t.name)) return false;
    seen.add(t.name);
    return true;
  });

  return normalizeNode({
    address: programAddress,
    metadata: {
      name: oldIdl?.name,
      version: oldIdl?.version,
      spec: "0.1.0", // Tell modern anchor it's a structural spec layout
    },
    instructions: (oldIdl.instructions || []).map((ix: any) => ({
      name: ix.name,
      discriminator: ix.discriminator || [],
      accounts: (ix.accounts || []).map((acc: any) => ({
        name: acc.name,
        writable: acc.isMut, // Old 'isMut' maps to 'writable'
        signer: acc.isSigner, // Old 'isSigner' maps to 'signer'
      })),
      args: ix.args,
    })),
    accounts: (oldIdl.accounts || []).map((acc: any) => ({
      name: acc.name,
      discriminator: accountDiscriminator(acc.name),
    })),
    types,
    events: oldIdl.events || [],
    errors: oldIdl.errors || [],
  }) as Idl;
}

/**
 * Returns a modern coral IDL, transforming legacy IDLs as needed and leaving
 * already-modern IDLs untouched.
 *
 * @param idl - Any IDL (modern coral or legacy serum-style).
 * @param programAddress - The on-chain program address (used when transforming).
 */
export function toModernIdl(idl: any, programAddress: string): Idl {
  return isCoralIdl(idl) ? (idl as Idl) : transformLegacyIdl(idl, programAddress);
}
