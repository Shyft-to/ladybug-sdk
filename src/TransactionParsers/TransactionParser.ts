import {
  PublicKey,
  VersionedTransactionResponse,
  Message,
  MessageV0,
  CompiledInstruction,
  MessageCompiledInstruction,
  VersionedMessage,
  ConfirmedTransactionMeta
} from "@solana/web3.js";
import {
  BorshCoder as CoralBorshCoder,
  Idl as CoralIdl,
  Instruction as CoralInstruction,
  utils
} from "@coral-xyz/anchor";
import {
  BorshCoder as SerumBorshCoder,
  Idl as SerumIdl,
  Instruction as SeruInstruction
} from "@project-serum/anchor";

type AnyIdl = CoralIdl | SerumIdl;

type TransactionParserField = {
  programId: string;
  idl: CoralIdl | SerumIdl;
  isCoral: boolean;
  coder: CoralBorshCoder | SerumBorshCoder;
}
export class TransactionParser {
  private transactionParsers: Map<string, TransactionParserField>;

  constructor() {
    this.transactionParsers = new Map();
  }

  addParser(programId: PublicKey, idl: CoralIdl | SerumIdl) {
    // this.transactionParsers.set(programId.toBase58(), { programId, idl, isCoral: TransactionParser.isCoralIdl(idl), coder: this.coder });
    let parserParams:any = {
      programId,
      idl,
      isCoral: TransactionParser.isCoralIdl(idl),
      coder: null
    }
    let coder;
    if(parserParams.isCoral) {
      coder = new CoralBorshCoder(idl as CoralIdl);
    } else {
      coder = new SerumBorshCoder(idl as SerumIdl);
    }
    parserParams = {...parserParams, coder}
    this.transactionParsers.set(programId.toBase58(), parserParams);
  }

  static isCoralIdl(idl: AnyIdl): idl is CoralIdl {
    return (
      "address" in idl ||
      ("instructions" in idl &&
        Array.isArray(idl.instructions) &&
        idl.instructions.length > 0 &&
        "discriminator" in idl.instructions[0])
    );
  }

  getAccountKeys(
    message: Message | MessageV0,
    meta: VersionedTransactionResponse["meta"]
  ) {
    let keys = message.staticAccountKeys.map((k) => k.toBase58());

    if (meta?.loadedAddresses) {
      keys = [
        ...keys,
        ...meta.loadedAddresses.writable.map((k) => k.toBase58()),
        ...meta.loadedAddresses.readonly.map((k) => k.toBase58()),
      ];
    }

    return keys;
  }
  getParsedCompiledInstruction(
    compiledInstructions: MessageCompiledInstruction[],
    allKeys: string[]
  ) {
    const decoded: {
      programId: string;
      accounts: string[];
      data: any;
    }[] = [];

    for (const ix of compiledInstructions) {
      const programId = allKeys[ix.programIdIndex];
      if(!programId || !this.transactionParsers.has(programId)) {
        //console.log(`Parser not available for programId ${programId}`);
        continue;
      }
      const coder = this.transactionParsers.get(programId)!.coder;
      let decodedInstruction;
      try {
        decodedInstruction = coder.instruction.decode(Buffer.from(ix.data));
      } catch (error) {
        console.log(`Error decoding instruction by idl: ${ix.data} for program ${programId}`);
        decodedInstruction = ix.data;
      }

      const accounts = ix.accountKeyIndexes.map((a) => allKeys[a]);
      decoded.push({
        programId,
        accounts,
        data: decodedInstruction,
      });
    }

    return decoded;
  }

  parseInnerInstructions(
    innerInstructions:
      | {
          index: number;
          instructions: (CompiledInstruction & { stackHeight?: number })[];
        }[]
      | null
      | undefined,
    allKeys: readonly string[]
  ): {
    outerIndex: number;
    programId: string;
    accounts: string[];
    data: CoralInstruction | SeruInstruction | string | null;
    stackHeight?: number;
  }[] {
    if (!innerInstructions) return [];

    const decoded: {
      outerIndex: number;
      programId: string;
      accounts: string[];
      data: CoralInstruction | SeruInstruction | string | null;
      stackHeight?: number;
    }[] = [];

    for (const group of innerInstructions) {
      const { index: outerIndex, instructions } = group;

      for (const ix of instructions) {
        const programId = allKeys[ix.programIdIndex];
        const accounts = ix.accounts.map((i) => allKeys[i]);

        if(!programId || !this.transactionParsers.has(programId)) {
          console.log(`Parser not available for programId ${programId}`);
          decoded.push({
            outerIndex,
            programId,
            accounts,
            data: Buffer.from(ix.data).toString("base64"),
            stackHeight: ix.stackHeight,
          });
          continue;
        }
        const coder = this.transactionParsers.get(programId)!.coder

        decoded.push({
          outerIndex,
          programId,
          accounts,
          data: coder.instruction.decode(ix.data),
          stackHeight: ix.stackHeight,
        });
      }
    }

    return decoded;
  }

  parseTransactionByIdl(tx: VersionedTransactionResponse) {
    const allKeys = this.getAccountKeys(tx.transaction.message, tx.meta);
    const parsedCompiledInstruction = this.getParsedCompiledInstruction(
      tx.transaction.message.compiledInstructions,
      allKeys
    );
    const parsedInnerInstructions = this.parseInnerInstructions(
      tx.meta?.innerInstructions,
      allKeys
    );

    const txWithParsed = {
      ...tx,
      transaction: {
        ...tx.transaction,
        message: {
          ...tx.transaction.message,
          parsedCompiledInstructions: parsedCompiledInstruction,
        },
      },
      meta: {
        ...tx.meta,
        parsedInnerInstructions: parsedInnerInstructions,
      }
    }

    return txWithParsed;
  }

  formTxnMessage(message: any): VersionedMessage {
    if (!message.versioned) {
      return new Message({
        header: {
          numRequiredSignatures: message.header.numRequiredSignatures,
          numReadonlySignedAccounts: message.header.numReadonlySignedAccounts,
          numReadonlyUnsignedAccounts:
            message.header.numReadonlyUnsignedAccounts,
        },
        recentBlockhash: utils.bytes.bs58.encode(
          Buffer.from(message.recentBlockhash, "base64")
        ),
        accountKeys: message.accountKeys?.map((d: string) =>
          Buffer.from(d, "base64")
        ),
        instructions: message.instructions.map(
          ({
            data,
            programIdIndex,
            accounts,
          }: {
            data: any;
            programIdIndex: any;
            accounts: any;
          }) => ({
            programIdIndex: programIdIndex,
            accounts: Array.from(accounts),
            data: utils.bytes.bs58.encode(Buffer.from(data || "", "base64")),
          })
        ),
      });
    } else {
      return new MessageV0({
        header: {
          numRequiredSignatures: message.header.numRequiredSignatures,
          numReadonlySignedAccounts: message.header.numReadonlySignedAccounts,
          numReadonlyUnsignedAccounts:
            message.header.numReadonlyUnsignedAccounts,
        },
        recentBlockhash: utils.bytes.bs58.encode(
          Buffer.from(message.recentBlockhash, "base64")
        ),
        staticAccountKeys: message.accountKeys.map(
          (k: string) => new PublicKey(Buffer.from(k, "base64"))
        ),
        compiledInstructions: message.instructions.map(
          ({
            programIdIndex,
            accounts,
            data,
          }: {
            programIdIndex: any;
            accounts: any;
            data: any;
          }) => ({
            programIdIndex: programIdIndex,
            accountKeyIndexes: Array.from(accounts),
            data: Uint8Array.from(Buffer.from(data || "", "base64")),
          })
        ),
        addressTableLookups:
          message.addressTableLookups?.map(
            ({
              accountKey,
              writableIndexes,
              readonlyIndexes,
            }: {
              accountKey: any;
              writableIndexes: any;
              readonlyIndexes: any;
            }) => ({
              writableIndexes: writableIndexes || [],
              readonlyIndexes: readonlyIndexes || [],
              accountKey: new PublicKey(Buffer.from(accountKey, "base64")),
            })
          ) || [],
      });
    }
  }

  public formatGrpcTransactionData(
    data: any,
    time: number
  ): VersionedTransactionResponse {
    const rawTx = data["transaction"];

    const slot = data.slot;
    const version = rawTx.transaction.message.versioned ? 0 : "legacy";

    const meta = this.formMeta(rawTx.meta);
    const signatures = rawTx.transaction.signatures.map((s: Buffer) =>
      utils.bytes.bs58.encode(s)
    );

    const message = this.formTxnMessage(rawTx.transaction.message);

    return {
      slot,
      version,
      blockTime: time,
      meta,
      transaction: {
        signatures,
        message,
      },
    };
  }

  private formMeta(meta: any): ConfirmedTransactionMeta {
    return {
      err: meta.errorInfo ? { err: meta.errorInfo } : null,
      fee: meta.fee,
      preBalances: meta.preBalances,
      postBalances: meta.postBalances,
      preTokenBalances: meta.preTokenBalances || [],
      postTokenBalances: meta.postTokenBalances || [],
      logMessages: meta.logMessages || [],
      loadedAddresses:
        meta.loadedWritableAddresses || meta.loadedReadonlyAddresses
          ? {
              writable:
                meta.loadedWritableAddresses?.map(
                  (address: PublicKey) => new PublicKey(address)
                ) || [],
              readonly:
                meta.loadedReadonlyAddresses?.map(
                  (address: PublicKey) => new PublicKey(address)
                ) || [],
            }
          : undefined,
      innerInstructions:
        meta.innerInstructions?.map(
          (i: { index: number; instructions: any }) => ({
            index: i.index || 0,
            instructions: i.instructions.map((instruction: any) => ({
              programIdIndex: instruction.programIdIndex,
              accounts: Array.from(instruction.accounts),
              data: utils.bytes.bs58.encode(
                Buffer.from(instruction.data || "", "base64")
              ),
            })),
          })
        ) || [],
    };
  }
}