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
    BorshAccountsCoder as CoralAccountsCoder,
    utils,
    EventParser as CoralEventParser
} from "@coral-xyz/anchor";

import {
    BorshCoder as SerumBorshCoder,
    Idl as SerumIdl,
    Instruction as SerumInstruction,
    BorshAccountsCoder as SerumBorshAccountsCoder,
    EventParser as SerumEventParser
} from "@project-serum/anchor";

import { IdlField as CoralIdlField, IdlTypeDefTyStruct as CoralIdlTypeDef, IdlDefinedFieldsNamed as CoralIdlDefinedFieldsNamed  } from "@coral-xyz/anchor/dist/cjs/idl";
import { IdlField as SerumIdlField } from "@project-serum/anchor/dist/cjs/idl";
import { intersection } from "lodash";

import { serializeStruct } from "../utils/account-formatter";
import { plaintextFormatter } from "../utils/common";

type AnyIdl = CoralIdl | SerumIdl;

export type GeyserAccountType = {
    account: {
        pubkey: PublicKey,
        lamports: string,
        owner: PublicKey,
        data: Buffer,
        executable: boolean,
        rentEpoch: string,
        writeVersion: string,
        txnSignature: Buffer
    },
    slot: string,
    isStartup?: boolean;
}
export type AccountInfo = {
    slot: number;
    pubkey: PublicKey;
    lamports: number;
    owner: PublicKey;
    data: any;
    executable: boolean;
    rentEpoch?: number;
}

export type ParserParams = {
    programId: string;
    idl: CoralIdl | SerumIdl;
    isCoral: boolean;
    coder: CoralBorshCoder | SerumBorshCoder;
    accountsMap: Map<string, CoralIdlField[] | SerumIdlField[]>;
    accountNames: Map<string, Buffer>;
    eventParser?: CoralEventParser | SerumEventParser;
}

export class Parser {
    solanaDataParsers: Map<string, ParserParams> = new Map();
    // accountParsers: Map<string, ParserParams> = new Map();

    addIDL(programId: PublicKey, idl: CoralIdl | SerumIdl) {
        // this.transactionParsers.set(programId.toBase58(), { programId, idl, isCoral: TransactionParser.isCoralIdl(idl), coder: this.coder });
        let parserParams: any = {
            programId,
            idl,
            isCoral: Parser.isCoralIdl(idl),
            coder: null
        }
        let coder;
        let accountsMap = new Map();
        let accountNames = new Map<string, Buffer>;
        let eventParser;
        if (parserParams.isCoral) {
            coder = new CoralBorshCoder(idl as CoralIdl);
            accountNames = new Map((idl as CoralIdl).accounts?.map((account) => ([
                account.name,
                Buffer.from(account.discriminator.map(item => Number(item)))
            ])));
            (idl as CoralIdl).accounts?.forEach(account => {
                const accountStruct = (idl.types!.find(t => t.name === account.name)!.type as CoralIdlTypeDef).fields! as CoralIdlDefinedFieldsNamed;
                accountsMap.set(account.name, accountStruct)
            });
            eventParser = new CoralEventParser(new PublicKey(programId), coder);
        } else {
            coder = new SerumBorshCoder(idl as SerumIdl);
            accountNames = new Map(idl.accounts?.map((account) => ([
                account.name,
                SerumBorshAccountsCoder.accountDiscriminator(account.name)
            ])));
            (idl as SerumIdl).accounts?.forEach(account => {
                accountsMap.set(account.name, account.type.fields)
            })
            eventParser = new SerumEventParser(new PublicKey(programId), coder);
        }
        
        parserParams = {
            ...parserParams,
            coder,
            accountNames,
            accountsMap,
            eventParser
        }
        
        this.solanaDataParsers.set(programId.toBase58(), parserParams);
        // this.accountParsers.set(programId.toString(), parserParams);
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
            const accounts = ix.accountKeyIndexes.map((a) => allKeys[a]);
            if (!programId || !this.solanaDataParsers.has(programId)) {
                //console.log(`Parser not available for programId ${programId}`);
                decoded.push({
                    programId,
                    accounts,
                    data: ix.data
                })
                continue;
            }
            const coder = this.solanaDataParsers.get(programId)!.coder;
            let decodedInstruction;
            try {
                decodedInstruction = plaintextFormatter(coder.instruction.decode(Buffer.from(ix.data)));
            } catch (error) {
                console.log(`Error decoding instruction by idl: ${ix.data} for program ${programId}`);
                decodedInstruction = ix.data;
            }

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

                if (!programId || !this.solanaDataParsers.has(programId)) {
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
                const coder = this.solanaDataParsers.get(programId)!.coder

                decoded.push({
                    outerIndex,
                    programId,
                    accounts,
                    data: plaintextFormatter(coder.instruction.decode(ix.data)),
                    stackHeight: ix.stackHeight,
                });
            }
        }

        return decoded;
    }

    parseEvents(txn: VersionedTransactionResponse, allKeys: string[]) {
        try {
            let programIds: string[] = [];

            txn.transaction.message.compiledInstructions.forEach((instruction) => {
                const programId = allKeys[instruction.programIdIndex];
                if (programId) {
                    programIds.push(programId);
                }
            });
            const availableProgramParsers = Array.from(this.solanaDataParsers.keys());
            const commonProgramIds = intersection(availableProgramParsers, programIds);
            if(!commonProgramIds.length) {
                return [];
            }
            const events: any[] = [];
            for(const programId of commonProgramIds) {
                const parser = this.solanaDataParsers.get(programId);
                if(!parser) {
                    console.log("Parser not available for programId: ", programId);
                    continue;
                }

                const eventParser = parser.eventParser;
                if(!eventParser) {
                    console.log("Event Parser not available for programId: ", programId);
                    continue;
                }

                const eventsArray = Array.from(eventParser.parseLogs(txn?.meta?.logMessages || []));
                events.push(...eventsArray);
            }
            return events;
        } catch (error) {
            return [];
        }   
    }

    parseTransaction(tx: VersionedTransactionResponse) {
        console.time("acc keys: ");
        const allKeys = this.getAccountKeys(tx.transaction.message, tx.meta);
        console.timeEnd("acc keys: ");
        console.log("Time ag account keys: ", Date.now());
        console.time("comp inst: ");
        const parsedCompiledInstruction = this.getParsedCompiledInstruction(
            tx.transaction.message.compiledInstructions,
            allKeys
        );
        console.timeEnd("comp inst: ");
        console.log("Time ag comp inst: ", Date.now());
        console.time("inner inst: ");
        const parsedInnerInstructions = this.parseInnerInstructions(
            tx.meta?.innerInstructions,
            allKeys
        );
        console.timeEnd("inner inst: ");
        console.log("Time ag inner inst: ", Date.now());
        console.time("parsed events: ");
        const parsedEvents = this.parseEvents(tx, allKeys);
        console.timeEnd("parsed events: ");
        console.log("Time ag parsed events: ", Date.now());
        if(tx.version === "legacy") {
            const txWithParsed = {
                ...tx,
                transaction: {
                    ...tx.transaction,
                    message: {
                        ...tx.transaction.message,
                        instructions: parsedCompiledInstruction,
                        events: plaintextFormatter(parsedEvents)
                    },
                },
                meta: {
                    ...tx.meta,
                    innerInstructions: parsedInnerInstructions,
                }
            }

            return txWithParsed;    
        }
        const txWithParsed = {
            ...tx,
            transaction: {
                ...tx.transaction,
                message: {
                    ...tx.transaction.message,
                    compiledInstructions: parsedCompiledInstruction,
                    events: plaintextFormatter(parsedEvents)
                },
            },
            meta: {
                ...tx.meta,
                innerInstructions: parsedInnerInstructions,
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

    private getAccountName(data: Buffer, accountNames: Map<string, Buffer>): string {
        const discriminator = data.subarray(0,8)

        let account = ''
        accountNames.forEach((accountDiscriminator, accountName) => {
            if (this.arraysEqual(discriminator, accountDiscriminator)) {
                account = accountName
            }
        })

        if (!account) {
            throw new Error(`[ ${new Date().toISOString()}} ] Account discriminator not found`);
        }

        return account
    }

    private arraysEqual(a: Buffer, b: Buffer): boolean {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    private decodeAccountData(data: Buffer, parser: ParserParams) {
        const accountNameByDiscriminator = this.getAccountName(data, parser.accountNames);
        const parsedData = parser.coder.accounts.decodeAny(data);
        const accountFields = parser.accountsMap.get(accountNameByDiscriminator);

        if (!accountFields) {
            throw new Error(`No account found with name ${accountNameByDiscriminator} for program ${parser.programId}`);
        }
        
        return {
            accountName: accountNameByDiscriminator,
            parsed: serializeStruct(parsedData, accountFields!, parser.idl.types)
        }
    }

    parseAccount(data: AccountInfo) {
        if(!this.solanaDataParsers.has(data.owner.toBase58())) {
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
            slot: data.slot
        }
    }

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

}
