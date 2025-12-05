import { ConfirmedTransactionMeta, MessageAddressTableLookup, ParsedInnerInstruction, TokenBalance, TransactionError } from "@solana/web3.js";

/**
 * Readable JSON-safe Solana transaction response.
 * Supports both version 0 and legacy transactions.
 */
export type ReadableTransactionResponse =
  | ReadableLegacyTransactionResponse
  | ReadableV0TransactionResponse;

export type ReadableLegacyTransactionResponse = {
  slot: string | number;
  version: "legacy";
  blockTime?: number | null;
  transaction: {
    signatures: string[];
    message: ReadableLegacyMessage;
  };
  meta: ReadableTransactionMeta | null;
};

export type ReadableLegacyMessage = {
  header: {
    numRequiredSignatures: number;
    numReadonlySignedAccounts: number;
    numReadonlyUnsignedAccounts: number;
  };
  accountKeys: string[];
  recentBlockhash: string;
  instructions: ReadableCompiledInstruction[];
  indexToProgramIds?: Record<string, string>;
  events?: ReadableEvent[];
};

export type ReadableV0TransactionResponse = {
  slot: string | number;
  version: 0;
  blockTime?: number | null;
  transaction: {
    signatures: string[];
    message: ReadableV0Message;
  };
  meta: ReadableTransactionMeta | null;
};

export type ReadableV0Message = {
  header: {
    numRequiredSignatures: number;
    numReadonlySignedAccounts: number;
    numReadonlyUnsignedAccounts: number;
  };
  staticAccountKeys: string[];
  recentBlockhash: string;
  compiledInstructions: ReadableCompiledInstruction[];
  addressTableLookups: any[];
  events?: ReadableEvent[];
};

export type ReadableCompiledInstruction = {
  programId: string;
  accounts: string[];
  data: any; // Could be buffer-like or parsed data
};

// export type ReadableAddressTableLookup = {
//   accountKey: string;
//   writableIndexes: number[];
//   readonlyIndexes: number[];
// };
export type ReadableAddressTableLookup = Omit<MessageAddressTableLookup, "accountKey"> & {
  accountKey: string;
};

export type ReadableEvent = {
  name: string;
  data: Record<string, any>;
};

type ReadableTransactionMeta = Omit<ConfirmedTransactionMeta, "innerInstructions"> & {
  innerInstructions?: {
    programId: string;
    accounts: string[];
    data: any;
  }[];
};

export type ReadableInnerInstruction = {
  outerIndex: number;
  programId: string;
  accounts: string[];
  data: any;
};

// export type ReadableTokenBalance = {
//   accountIndex: number;
//   mint: string;
//   owner: string;
//   programId: string;
//   uiTokenAmount: {
//     uiAmount: number;
//     decimals: number;
//     amount: string;
//     uiAmountString: string;
//   };
// };
