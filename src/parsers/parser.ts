import {
  PublicKey,
  VersionedTransactionResponse,
  Message,
  MessageV0,
  CompiledInstruction,
  MessageCompiledInstruction,
  VersionedMessage,
  ConfirmedTransactionMeta,
  MessageHeader,
  LoadedAddresses,
} from "@solana/web3.js";

import {
  BorshCoder as CoralBorshCoder,
  Idl as CoralIdl,
  Instruction as CoralInstruction,
  BorshAccountsCoder as CoralAccountsCoder,
  utils,
  EventParser as CoralEventParser,
} from "@coral-xyz/anchor";

import {
  BorshCoder as SerumBorshCoder,
  Idl as SerumIdl,
  Instruction as SerumInstruction,
  BorshAccountsCoder as SerumBorshAccountsCoder,
  EventParser as SerumEventParser,
} from "@project-serum/anchor";

import {
  IdlField as CoralIdlField,
  IdlTypeDefTyStruct as CoralIdlTypeDef,
  IdlDefinedFieldsNamed as CoralIdlDefinedFieldsNamed,
} from "@coral-xyz/anchor/dist/cjs/idl";
import { IdlField as SerumIdlField } from "@project-serum/anchor/dist/cjs/idl";
import { intersection } from "lodash";

import { serializeStruct } from "../utils/account-formatter";
import { buildAccountMetaMap, getAccountMetasFromStrings, getInstructionAccountMetas, plaintextFormatter } from "../utils/common";

import {
  ReadableTransactionResponse,
  ReadableLegacyTransactionResponse,
  ReadableV0TransactionResponse,
} from "../types";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { decodeTokenInstruction } from "./token-program-parser";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
import { decodeSystemInstruction } from "./system-program-parser";
import { decodeToken2022Instruction } from "./token-2022-parser";
import { decodeAssociatedTokenInstruction } from "./associated-token-parser";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

type AnyIdl = CoralIdl | SerumIdl;

export type GeyserAccountType = {
  account: {
    pubkey: PublicKey;
    lamports: string;
    owner: PublicKey;
    data: Buffer;
    executable: boolean;
    rentEpoch: string;
    writeVersion: string;
    txnSignature: Buffer;
  };
  slot: string;
  isStartup?: boolean;
};
export type AccountInfo = {
  slot: number;
  pubkey: PublicKey;
  lamports: number;
  owner: PublicKey;
  data: any;
  executable: boolean;
  rentEpoch?: number;
};

export type ParserParams = {
  programId: string;
  idl: CoralIdl | SerumIdl;
  isCoral: boolean;
  coder: CoralBorshCoder | SerumBorshCoder;
  accountsMap: Map<string, CoralIdlField[] | SerumIdlField[]>;
  accountNames: Map<string, Buffer>;
  eventParser?: CoralEventParser | SerumEventParser;
};

export class Parser {
  private solanaDataParsers: Map<string, ParserParams> = new Map();
  private parseDefaultInstructions: boolean = false;
  // accountParsers: Map<string, ParserParams> = new Map();
  private instructionSet: Set<string> = new Set();
  private enableLogs: boolean = true;
  private eventParsingEnabled: boolean = true;

  /**
   * This parser uses the IDLs to parse the transaction and accounts data. A parser can take multiple IDLs.
   * @param programId - The PublicKey of the program.
   * @param idl - The IDL to add.
   */
  addIDL(programId: PublicKey, idl: CoralIdl | SerumIdl) {
    // this.transactionParsers.set(programId.toBase58(), { programId, idl, isCoral: TransactionParser.isCoralIdl(idl), coder: this.coder });
    let parserParams: any = {
      programId,
      idl,
      isCoral: Parser.isCoralIdl(idl),
      coder: null,
    };
    let coder;
    let accountsMap = new Map();
    let accountNames = new Map<string, Buffer>();
    let eventParser;
    if (parserParams.isCoral) {
      coder = new CoralBorshCoder(idl as CoralIdl);
      accountNames = new Map(
        (idl as CoralIdl).accounts?.map((account) => [
          account.name,
          Buffer.from(account.discriminator.map((item) => Number(item))),
        ])
      );
      (idl as CoralIdl).accounts?.forEach((account) => {
        const accountStruct = (
          idl.types!.find((t) => t.name === account.name)!
            .type as CoralIdlTypeDef
        ).fields! as CoralIdlDefinedFieldsNamed;
        accountsMap.set(account.name, accountStruct);
      });
      eventParser = new CoralEventParser(new PublicKey(programId), coder);
    } else {
      coder = new SerumBorshCoder(idl as SerumIdl);
      accountNames = new Map(
        idl.accounts?.map((account) => [
          account.name,
          SerumBorshAccountsCoder.accountDiscriminator(account.name),
        ])
      );
      (idl as SerumIdl).accounts?.forEach((account) => {
        accountsMap.set(account.name, account.type.fields);
      });
      eventParser = new SerumEventParser(new PublicKey(programId), coder);
    }

    parserParams = {
      ...parserParams,
      coder,
      accountNames,
      accountsMap,
      eventParser,
    };

    this.solanaDataParsers.set(programId.toBase58(), parserParams);
    idl.instructions.forEach((ix) => {
      this.instructionSet.add(ix.name);
    });
    // this.accountParsers.set(programId.toString(), parserParams);
  }

/**
 * Enables or disables the default System and Token instruction parsing. Disabled by default.
 * When enabled, System program, Token program, and Token 2022 program instructions will be parsed.
 * Instruction will be parsed based on the @solana/spl-token and @solana/web3 js library.
 * @param enable - Whether to enable or disable default instruction parsing.
 */
  public useDefaultInstructionParsing(enable: boolean) {
    this.parseDefaultInstructions = enable;
  }

  /**
   * Checks if an IDL is a Coral IDL or not.
   * A Coral IDL is one which has an "address" field or an "instructions" field with at least one instruction with a "discriminator" field.
   * @param idl - The IDL to check.
   * @returns True if the IDL is a Coral IDL, false otherwise.
   */
  static isCoralIdl(idl: AnyIdl): idl is CoralIdl {
    return (
      "address" in idl ||
      ("instructions" in idl &&
        Array.isArray(idl.instructions) &&
        idl.instructions.length > 0 &&
        "discriminator" in idl.instructions[0])
    );
  }

  /**
   * Returns a set of all the instructions in the IDLs combined.
   * @returns A set of all the instructions in the IDLs.
   */
  public getAllInstructions(): Set<string> {
    return this.instructionSet;
  }

  /**
   * Retrieves the account keys from a transaction message and its associated transaction meta data.
   * The returned array will contain the static account keys from the message, as well as the loaded addresses from the meta data.
   * The loaded addresses are split into two categories: writable and readonly.
   * @param {Message|MessageV0} message - The transaction message.
   * @param {VersionedTransactionResponse["meta"]} meta - The transaction meta data.
   * @returns {string[]} An array of account keys.
   */
  private getAccountKeys(
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

  /**
   * Parses the compiled instructions in the transaction message and returns a decoded array of instructions.
   * The decoded array contains the programId, accounts, and decoded instruction data.
   * @param {MessageCompiledInstruction[]} compiledInstructions - The compiled instructions from the transaction message.
   * @param {string[]} allKeys - The list of all account keys in the transaction message.
   * @returns { { programId: string; accounts: string[]; data: any }[] } - The decoded array of instructions.
   */
  private getParsedCompiledInstruction(
    compiledInstructions: MessageCompiledInstruction[],
    allKeys: string[],
    messageHeader: MessageHeader, 
    accountKeys: PublicKey[],
    loadedAddresses: LoadedAddresses | undefined
  ) {
    const decoded: {
      programId: string;
      accounts: string[];
      data: any;
    }[] = [];
    
    for (const ix of compiledInstructions) {
      const programId = allKeys[ix.programIdIndex];
      const accounts = ix.accountKeyIndexes.map((a) => allKeys[a]);
       if(this.parseDefaultInstructions) {
        const superMap = buildAccountMetaMap(accountKeys, messageHeader, loadedAddresses);
        const keys = getInstructionAccountMetas(accounts, superMap);
        if(programId === TOKEN_PROGRAM_ID.toBase58()) {
          try {
            const decodedIx = decodeTokenInstruction({keys,programId: TOKEN_PROGRAM_ID, data: Buffer.from(ix.data)});
            decoded.push({
              programId,
              accounts,
              data: decodedIx ? plaintextFormatter(decodedIx) : null,
            });  
          } catch (error) {
            if(this.enableLogs) 
              console.error("Failed to decode token instruction", error);
            decoded.push({
              programId,
              accounts,
              data: bs58.encode(ix.data) || ix.data,
            });
          }
          
          continue;
        }
        if(programId === SYSTEM_PROGRAM_ID.toBase58()) {
          const keys = getInstructionAccountMetas(accounts, superMap);
          try {
            const decodedIx = decodeSystemInstruction({keys,programId: SYSTEM_PROGRAM_ID, data: Buffer.from(ix.data)});
            decoded.push({
              programId,
              accounts,
              data: decodedIx ? plaintextFormatter(decodedIx): null,
            });  
          } catch (error) {
            if(this.enableLogs)
              console.log(`Error decoding system instruction: ${ix.data}`);
            decoded.push({
              programId,
              accounts,
              data: bs58.encode(ix.data) || ix.data
            })
          }
          
          continue;
        }
        if(programId === ASSOCIATED_TOKEN_PROGRAM_ID.toBase58()) {
          const keys = getInstructionAccountMetas(accounts, superMap);
          try {
            const decodedIx = decodeAssociatedTokenInstruction({keys,programId: ASSOCIATED_TOKEN_PROGRAM_ID, data: Buffer.from(ix.data)});
            decoded.push({
              programId,
              accounts,
              data: decodedIx ? plaintextFormatter(decodedIx): null,
            });
          } catch (error) {
            if(this.enableLogs)
              console.log(`Error decoding associated token instruction: ${ix.data}`);
            decoded.push({
              programId,
              accounts,
              data: bs58.encode(ix.data) || ix.data
            })
          }
          
          continue;
        }
        if(programId === TOKEN_2022_PROGRAM_ID.toBase58()) {
          const keys = getInstructionAccountMetas(accounts, superMap);
          try {
            const decodedIx = decodeToken2022Instruction({keys,programId: TOKEN_2022_PROGRAM_ID, data: Buffer.from(ix.data)});
          
            decoded.push({
              programId,
              accounts,
              data: decodedIx ? plaintextFormatter(decodedIx): null,
            });  
          } catch (error) {
            if(this.enableLogs)
              console.log(`Error decoding token 2022 instruction: ${ix.data}`);
            decoded.push({
              programId,
              accounts,
              data: bs58.encode(ix.data) || ix.data
            })
          }
          
          continue;
        }
      }

      if (!programId || !this.solanaDataParsers.has(programId)) {
        //console.log(`Parser not available for programId ${programId}`);
        decoded.push({
          programId,
          accounts,
          data: bs58.encode(ix.data) || ix.data,
        });
        continue;
      }
      const coder = this.solanaDataParsers.get(programId)!.coder;
      try {
        let decodedInstruction;
        if (typeof ix.data === "string" || !ix.data) {
          decodedInstruction = coder.instruction.decode(ix.data, "base58");
        } else {
          decodedInstruction = coder.instruction.decode(bs58.encode(ix.data),"base58");
        }
        decoded.push({
          programId,
          accounts,
          data: plaintextFormatter(decodedInstruction),
        });
      } catch (error) {
        if(this.enableLogs)
          console.log(
            `Error decoding instruction by idl: ${ix.data} for program ${programId}`
          );
        decoded.push({
          programId,
          accounts,
          data: bs58.encode(ix.data) || ix.data,
        });
      }
    }

    return decoded;
  }

  private parseInnerInstructions(
    innerInstructions:
      | {
          index: number;
          instructions: (CompiledInstruction & { stackHeight?: number })[];
        }[]
      | null
      | undefined,
    allKeys: readonly string[],
    messageHeader: MessageHeader, 
    accountKeys: PublicKey[],
    loadedAddresses: LoadedAddresses | undefined
  ): {
    outerIndex: number;
    programId: string;
    accounts: string[];
    data: CoralInstruction | SerumInstruction | string | null;
    stackHeight?: number;
  }[] {
    if (!innerInstructions) return [];

    const decoded: {
      outerIndex: number;
      programId: string;
      accounts: string[];
      data: CoralInstruction | SerumInstruction | string | null;
      stackHeight?: number;
    }[] = [];

    for (const group of innerInstructions) {
      const { index: outerIndex, instructions } = group;

      for (const ix of instructions) {
        const programId = allKeys[ix.programIdIndex];
        const accounts = ix.accounts.map((i) => allKeys[i]);

        if(this.parseDefaultInstructions) {
          const superMap = buildAccountMetaMap(accountKeys, messageHeader, loadedAddresses);
          const keys = getInstructionAccountMetas(accounts, superMap);
          if(programId === TOKEN_PROGRAM_ID.toBase58()) {
            try {
              const decodedIx = decodeTokenInstruction({keys,programId: TOKEN_PROGRAM_ID, data: bs58.decode(ix.data)});
              decoded.push({
                outerIndex,
                programId,
                accounts,
                data: decodedIx ? plaintextFormatter(decodedIx): null,
              });  
            } catch (error) {
              if(this.enableLogs)
                console.log(`Error decoding token instruction: ${ix.data}`);
              decoded.push({
                outerIndex,
                programId,
                accounts,
                data: ix.data
              })
            }
            continue;
          }
          if(programId === SYSTEM_PROGRAM_ID.toBase58()) {
            const keys = getInstructionAccountMetas(accounts, superMap);
            try {
              const decodedIx = decodeSystemInstruction({keys,programId: SYSTEM_PROGRAM_ID, data: bs58.decode(ix.data)});
              decoded.push({
                outerIndex,
                programId,
                accounts,
                data: decodedIx ? plaintextFormatter(decodedIx): null,
              });  
            } catch (error) {
              if(this.enableLogs)
                console.log(`Error decoding system instruction: ${ix.data}`);
              decoded.push({
                outerIndex,
                programId,
                accounts,
                data: ix.data
              })
            }
            continue;
          }
          if(programId === ASSOCIATED_TOKEN_PROGRAM_ID.toBase58()) {
            const keys = getInstructionAccountMetas(accounts, superMap);
            try {
              const decodedIx = decodeAssociatedTokenInstruction({keys,programId: ASSOCIATED_TOKEN_PROGRAM_ID, data: bs58.decode(ix.data)});
              decoded.push({
                outerIndex,
                programId,
                accounts,
                data: decodedIx ? plaintextFormatter(decodedIx): null,
              });
            } catch (error) {
              if(this.enableLogs)
                console.log(`Error decoding associated token instruction: ${ix.data}`);
              decoded.push({
                outerIndex,
                programId,
                accounts,
                data: ix.data
              })
            }
            
            continue;
          }
          if(programId === TOKEN_2022_PROGRAM_ID.toBase58()) {
            const keys = getInstructionAccountMetas(accounts, superMap);
            try {
              const decodedIx = decodeToken2022Instruction({keys,programId: TOKEN_2022_PROGRAM_ID, data: bs58.decode(ix.data)});
              decoded.push({
                outerIndex,
                programId,
                accounts,
                data: decodedIx ? plaintextFormatter(decodedIx): null,
              });  
            } catch (error) {
              if(this.enableLogs)
                console.log(`Error decoding token 2022 instruction: ${ix.data}`);
              decoded.push({
                outerIndex,
                programId,
                accounts,
                data: ix.data
              })
            }
            
            continue;
          }
        }

        if (!programId || !this.solanaDataParsers.has(programId)) {
          // console.log(`Parser not available for programId ${programId}`);
          decoded.push({
            outerIndex,
            programId,
            accounts,
            data: ix.data,
            stackHeight: ix.stackHeight,
          });
          continue;
        }

        const parser = this.solanaDataParsers.get(programId);
        if(!parser) {
          decoded.push({
            outerIndex,
            programId,
            accounts,
            data: ix.data,
            stackHeight: ix.stackHeight,
          });
          continue;
        }

        const coder = parser.coder;
        try {
          let decodedIx;
          
          if (typeof ix.data === "string" || !ix.data) {
            decodedIx = coder.instruction.decode(ix.data, "base58");
          } else {
            decodedIx = coder.instruction.decode(ix.data);
          }

          decoded.push({
            outerIndex,
            programId,
            accounts,
            data: plaintextFormatter(decodedIx),
            stackHeight: ix.stackHeight,
          });  
        } catch (error) {
          if(this.enableLogs)
            console.log(`Error decoding inner instruction by idl: ${ix.data} for program ${programId}`);
          decoded.push({
            outerIndex,
            programId,
            accounts,
            data: ix.data,
            stackHeight: ix.stackHeight,
          });
        }
      }
    }

    return decoded;
  }

  private parseEvents(txn: VersionedTransactionResponse, allKeys: string[]) {
    try {
      let programIds: string[] = [];

      txn.transaction.message.compiledInstructions.forEach((ix) => {
        const programId = allKeys[ix.programIdIndex];
        if (programId) programIds.push(programId);
      });

      const inner = txn.meta?.innerInstructions;
      if (inner && Array.isArray(inner)) {
        inner.forEach((group) => {
          group.instructions.forEach((ix) => {
            const programId = allKeys[ix.programIdIndex];
            if (programId) programIds.push(programId);
          });
        });
      }

      programIds = Array.from(new Set(programIds));

      const available = Array.from(this.solanaDataParsers.keys());
      const commonProgramIds = intersection(available, programIds);

      if (!commonProgramIds.length) return [];

      const events: any[] = [];

      for (const programId of commonProgramIds) {
        const parser = this.solanaDataParsers.get(programId);
        if (!parser || !parser.eventParser) continue;

        const parsed = Array.from(
          parser.eventParser.parseLogs(txn.meta?.logMessages || [])
        );

        events.push(...parsed);
      }

      return events;
    } catch (error) {
      return [];
    }
  }

  private convertLoadedAddresses(loaded?: {
    writable: PublicKey[] | string[];
    readonly: PublicKey[] | string[];
  }) {
    if (!loaded) return { writable: [], readonly: [] };

    return {
      writable: loaded.writable.map((k: any) =>
        typeof k === "string" ? k : k.toBase58()
      ),
      readonly: loaded.readonly.map((k: any) =>
        typeof k === "string" ? k : k.toBase58()
      ),
    };
  }

  private convertAddressTableLookups(lookups?: {
    accountKey: PublicKey;
    writableIndexes: number[];
    readonlyIndexes: number[];
  }[]) {
    if (!lookups) return [];

    return lookups.map(l => ({
      accountKey: l.accountKey.toBase58(),
      writableIndexes: l.writableIndexes,
      readonlyIndexes: l.readonlyIndexes,
    }));
  }



  /**
   * Parse a transaction and return a new transaction with parsed instructions and events.
   * The parsed transaction will have the following properties:
   * - transaction.message.instructions: an array of parsed compiled instructions
   * - transaction.message.events: an array of parsed events
   * - meta.innerInstructions: an array of parsed inner instructions
   *
   * @param {VersionedTransactionResponse} tx - The transaction to parse
   * @returns {VersionedTransactionResponse} - The parsed transaction
   */
  parseTransaction(tx: VersionedTransactionResponse) {
    const allKeys = this.getAccountKeys(tx.transaction.message, tx.meta);
    const parsedCompiledInstruction = this.getParsedCompiledInstruction(
      tx.transaction.message.compiledInstructions,
      allKeys,
      tx.transaction.message.header, 
      tx.version === "legacy"?(tx.transaction.message as Message).accountKeys:tx.transaction.message.staticAccountKeys,
      tx.meta?.loadedAddresses
    );
    const parsedInnerInstructions = this.parseInnerInstructions(
      tx.meta?.innerInstructions,
      allKeys,
      tx.transaction.message.header, 
      tx.version === "legacy"?(tx.transaction.message as Message).accountKeys:tx.transaction.message.staticAccountKeys,
      tx.meta?.loadedAddresses
    );
    const parsedEvents = this.eventParsingEnabled ? this.parseEvents(tx, allKeys) : [];

    if (tx.version === "legacy") {
      const txMessage = tx.transaction.message as Message;
      const txWithParsed: ReadableLegacyTransactionResponse = {
        ...tx,
        version: "legacy",
        transaction: {
          ...tx.transaction,
          message: {
            ...txMessage,
            accountKeys: txMessage.accountKeys.map((key: PublicKey) =>
              key.toBase58()
            ),
            instructions: parsedCompiledInstruction,
            events: plaintextFormatter(parsedEvents),
          },
        },
        meta: tx.meta && {
          ...tx.meta,
          innerInstructions: parsedInnerInstructions,
          loadedAddresses: this.convertLoadedAddresses(tx.meta.loadedAddresses),
        },
      };
      return txWithParsed;
    }

    const txMessage = tx.transaction.message as MessageV0;
    const txWithParsed: ReadableV0TransactionResponse = {
      ...tx,
      version: 0,
      transaction: {
        ...tx.transaction,
        message: {
          ...txMessage,
          recentBlockhash: utils.bytes.bs58.encode(
            Buffer.from(txMessage.recentBlockhash)
          ),
          staticAccountKeys: txMessage.staticAccountKeys.map((key: PublicKey) =>
            key.toBase58()
          ),
          addressTableLookups: this.convertAddressTableLookups(
            txMessage.addressTableLookups
          ),
          compiledInstructions: parsedCompiledInstruction,
          events: plaintextFormatter(parsedEvents),
        },
      },
      meta: tx.meta && {
        ...tx.meta,
        innerInstructions: parsedInnerInstructions,
        loadedAddresses: this.convertLoadedAddresses(tx.meta.loadedAddresses),
      },
    };

    return txWithParsed;
  }

  /**
   * Convert a transaction message to a VersionedMessage.
   * If the message is legacy, it will be converted to a VersionedMessage with the following properties:
   * - header: the header of the message
   * - recentBlockhash: the recent block hash of the message
   * - accountKeys: an array of account public keys
   * - instructions: an array of parsed compiled instructions
   * If the message is not legacy, it will be converted to a VersionedMessage with the following properties:
   * - header: the header of the message
   * - recentBlockhash: the recent block hash of the message
   * - staticAccountKeys: an array of account public keys
   * - compiledInstructions: an array of parsed compiled instructions
   * - addressTableLookups: an array of address table lookups
   * @param {any} message - The transaction message to convert
   * @returns {VersionedMessage} - The converted transaction message
   */
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
            data: Buffer.from(data || "", "base64"),
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

  /**
   * Formats a transaction object returned from the gRPC API into a VersionedTransactionResponse object.
   * @param data - The transaction object returned from the gRPC API.
   * @param time - The block time of the transaction.
   * @returns A VersionedTransactionResponse object.
   */
  public formatGrpcTransactionData(
    data: any,
    time: number
  ): VersionedTransactionResponse {
    const rawTx = data["transaction"];

    const slot = data.slot;
    const version = rawTx.transaction.message.versioned ? 0 : "legacy";

    const meta = this.formMeta(rawTx?.meta);
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

  private formMeta(meta: any): ConfirmedTransactionMeta | null {
    if(!meta) 
      return null
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

  private getAccountName(
    data: Buffer,
    accountNames: Map<string, Buffer>
  ): string {
    const discriminator = data.subarray(0, 8);

    let account = "";
    accountNames.forEach((accountDiscriminator, accountName) => {
      if (this.arraysEqual(discriminator, accountDiscriminator)) {
        account = accountName;
      }
    });

    if (!account) {
      throw new Error(
        `[ ${new Date().toISOString()}} ] Account discriminator not found`
      );
    }

    return account;
  }

  private arraysEqual(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  private decodeAccountData(data: Buffer, parser: ParserParams) {
    const accountNameByDiscriminator = this.getAccountName(
      data,
      parser.accountNames
    );
    const parsedData = parser.coder.accounts.decodeAny(data);
    const accountFields = parser.accountsMap.get(accountNameByDiscriminator);

    if (!accountFields) {
      throw new Error(
        `No account found with name ${accountNameByDiscriminator} for program ${parser.programId}`
      );
    }

    return {
      accountName: accountNameByDiscriminator,
      parsed: serializeStruct(parsedData, accountFields!, parser.idl.types),
    };
  }

  /**
   * Parse the account data.
   * @param {AccountInfo} data - The data of the account to parse.
   * @returns {object} - The parsed account data.
   * @throws {Error} - If the account parser is not found for the account owner.
   */
  parseAccount(data: AccountInfo) {
    if (!this.solanaDataParsers.has(data.owner.toBase58())) {
      throw new Error(`Account parser not found for ${data.owner.toBase58()}`);
    }
    const parser = this.solanaDataParsers.get(data.owner.toString())!;

    const parsedData = this.decodeAccountData(data.data, parser);

    return {
      data: data.data,
      parsed: parsedData,
      pubkey: data.pubkey.toBase58(),
      lamports: data.lamports,
      owner: data.owner.toBase58(),
      executable: data.executable,
      rentEpoch: data.rentEpoch,
      slot: data.slot,
    };
  }

  /**
   * Data received from gRPC is slightly different from AccountInfo. This function formats a GeyserAccountType (gRPC Received Data)
   * object into an AccountInfo object.
   * @param {GeyserAccountType} geyserAcc - The GeyserAccountType object to format.
   * @returns {AccountInfo} - The formatted AccountInfo object.
   */
  formatGeyserAccountData(geyserAcc: GeyserAccountType): AccountInfo {
    return {
      slot: Number(geyserAcc.slot),
      pubkey: new PublicKey(geyserAcc.account.pubkey),
      lamports: Number(geyserAcc.account.lamports),
      owner: new PublicKey(geyserAcc.account.owner),
      data: geyserAcc.account.data,
      executable: geyserAcc.account.executable,
      rentEpoch: Number(geyserAcc.account.rentEpoch),
    };
  }

  /**
   * Enables or disables logging for the parser. Enabled by default.
   * When enabled, the parser will log errors to the console.
   * @param {boolean} enable - Whether to enable or disable logging.
   */
  enableLogging(enable: boolean) {
    this.enableLogs = enable;
  }

  enableEventParsing(enable: boolean) {
    this.eventParsingEnabled = enable;
  }
}
