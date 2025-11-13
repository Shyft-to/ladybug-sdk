import { PublicKey, MessageHeader, AccountMeta, CompiledInstruction } from "@solana/web3.js";
import { isObject } from "lodash";

export function plaintextFormatter(obj: any) {
  for (const key in obj) {
    if (obj[key]?.constructor?.name === "PublicKey") {
      obj[key] = (obj[key] as PublicKey).toBase58();
    } else if (obj[key]?.constructor?.name === "BN") {
      obj[key] = Number(obj[key].toString());
    } else if (obj[key]?.constructor?.name === "BigInt") {
      obj[key] = Number(obj[key].toString());
    } else if (obj[key]?.constructor?.name === "Buffer") {
      obj[key] = (obj[key] as Buffer).toString("base64");
    } else if (isObject(obj[key])) {
      plaintextFormatter(obj[key]);
    } 
  }
  return obj;
}

export function getAccountMetasFromStrings(
  accountKeys: PublicKey[],
  header: MessageHeader
): AccountMeta[] {
  const {
    numRequiredSignatures,
    numReadonlySignedAccounts,
    numReadonlyUnsignedAccounts,
  } = header;

  const totalKeys = accountKeys.length;

  return accountKeys.map((key, index) => {
    const pubkey = key;
    const isSigner = index < numRequiredSignatures;

    let isWritable: boolean;

    if (isSigner) {
      // Signed accounts: last `numReadonlySignedAccounts` are readonly
      isWritable = index < numRequiredSignatures - numReadonlySignedAccounts;
    } else {
      // Unsigned accounts: last `numReadonlyUnsignedAccounts` are readonly
      const unsignedIndex = index - numRequiredSignatures;
      const unsignedCount = totalKeys - numRequiredSignatures;
      isWritable = unsignedIndex < unsignedCount - numReadonlyUnsignedAccounts;
    }

    return { pubkey, isSigner, isWritable };
  });
}

export function buildAccountMetaMap(
  accountKeys: PublicKey[],
  header: {
    numRequiredSignatures: number;
    numReadonlySignedAccounts: number;
    numReadonlyUnsignedAccounts: number;
  }
): Map<PublicKey, AccountMeta> {
  const map = new Map<PublicKey, AccountMeta>();

  const {
    numRequiredSignatures,
    numReadonlySignedAccounts,
    numReadonlyUnsignedAccounts,
  } = header;

  const totalKeys = accountKeys.length;

  for (let i = 0; i < totalKeys; i++) {
    const pubkey = accountKeys[i];

    const isSigner = i < numRequiredSignatures;

    let isWritable: boolean;
    if (isSigner) {
      isWritable = i < numRequiredSignatures - numReadonlySignedAccounts;
    } else {
      const unsignedIndex = i - numRequiredSignatures;
      isWritable =
        unsignedIndex <
        totalKeys -
          numRequiredSignatures -
          numReadonlyUnsignedAccounts;
    }

    map.set(pubkey, { pubkey, isSigner, isWritable });
  }

  return map;
}

/**
 * Extract only relevant accounts from an instruction
 */
export function getInstructionAccountMetas(
  accountKeys: string[],
  accountMetaMap: Map<PublicKey, AccountMeta>
): AccountMeta[] {
  const metas: AccountMeta[] = [];

  for (const key of accountKeys) {
    for (const [pubkey, meta] of accountMetaMap.entries()) {
      if (pubkey.toBase58() === key) {
        metas.push(meta);
        break;
      }
    }
  }

  return metas;
}
