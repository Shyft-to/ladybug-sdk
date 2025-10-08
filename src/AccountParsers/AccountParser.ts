import { PublicKey } from "@solana/web3.js";
import {
  BorshCoder as CoralBorshCoder,
  Idl as CoralIdl,
  BorshAccountsCoder as CoralAccountsCoder,
  utils
} from "@coral-xyz/anchor";
import {
  BorshCoder as SerumBorshCoder,
  BorshAccountsCoder as SerumBorshAccountsCoder,
  Idl as SerumIdl,
} from "@project-serum/anchor";
import { IdlField as CoralIdlField, IdlTypeDefTyStruct as CoralIdlTypeDef, IdlDefinedFieldsNamed as CoralIdlDefinedFieldsNamed  } from "@coral-xyz/anchor/dist/cjs/idl";
import { IdlField as SerumIdlField } from "@project-serum/anchor/dist/cjs/idl";

import { serializeStruct } from "../utils/account-formatter";

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

export type AccountParserField = {
    programId: PublicKey;
    idl: CoralIdl | SerumIdl;
    coder: CoralBorshCoder | SerumBorshCoder;
    accountNames: Map<string, Buffer>;
    accountsMap: Map<string, CoralIdlField[] | SerumIdlField[]>
}

export class AccountParser {

    private accountParsers: Map<string, AccountParserField>;

    constructor() {
        this.accountParsers = new Map<string, AccountParserField>();
    }
    addDecoder(programId: PublicKey, idl: CoralIdl | SerumIdl) {
        let parserParams: any = {
            programId,
            idl,
            isCoral: AccountParser.isCoralIdl(idl)
        }
        let coder;
        let accountsMap = new Map();
        let accountNames = new Map<string, Buffer>;

        if (AccountParser.isCoralIdl(idl)) {
            coder = new CoralBorshCoder(idl as CoralIdl);
            accountNames = new Map((idl as CoralIdl).accounts?.map((account) => ([
                account.name,
                Buffer.from(account.discriminator.map(item => Number(item)))
            ])));
            (idl as CoralIdl).accounts?.forEach(account => {
                const accountStruct = (idl.types!.find(t => t.name === account.name)!.type as CoralIdlTypeDef).fields! as CoralIdlDefinedFieldsNamed;
                accountsMap.set(account.name, accountStruct)
            });
            
        } else {
            coder = new SerumBorshCoder(idl as SerumIdl);
            accountNames = new Map(idl.accounts?.map((account) => ([
                account.name,
                SerumBorshAccountsCoder.accountDiscriminator(account.name)
            ])));
            (idl as SerumIdl).accounts?.forEach(account => {
                accountsMap.set(account.name, account.type.fields)
            })
        }

        parserParams = {
            ...parserParams,
            coder,
            accountNames,
            accountsMap
        }

        this.accountParsers.set(programId.toString(), parserParams);
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

    decodeAccountData(data: Buffer, coder: CoralBorshCoder | SerumBorshCoder): any {
        return coder.accounts.decodeAny(data);
    }

    parseAccountData(data: AccountInfo) {
        if(!this.accountParsers.has(data.owner.toBase58())) {
            throw new Error(`Account parser not found for ${data.owner.toBase58()}`);
        }

        const parser = this.accountParsers.get(data.owner.toString());
        const parsedData = parser?.coder.accounts.decodeAny(data.data);

        return {
            data: data.data,
            parsed: parsedData,
            pubkey: data.pubkey,
            lamports: data.lamports,
            owner: data.owner,
            executable: data.executable,
            rentEpoch: data.rentEpoch,
            slot: data.slot
        }
    
    }

    private decodeAccountDataReadable(data: Buffer, parser: AccountParserField) {
        const accountNameByDiscriminator = this.getAccountName(data, parser.accountNames);
        const parsedData = parser.coder.accounts.decodeAny(data);
        const accountFields = parser.accountsMap.get(accountNameByDiscriminator);

        if (!accountFields) {
            throw new Error(`No account found with name ${accountNameByDiscriminator} for program ${parser.programId.toBase58()}`);
        }
        
        return {
            accountName: accountNameByDiscriminator,
            parsed: serializeStruct(parsedData, accountFields!, parser.idl.types)
        }
    }

    parsedAccountDataReadable(data: AccountInfo) {
        if(!this.accountParsers.has(data.owner.toBase58())) {
            throw new Error(`Account parser not found for ${data.owner.toBase58()}`);
        }
        const parser = this.accountParsers.get(data.owner.toString())!;

        const parsedData = this.decodeAccountDataReadable(data.data, parser);
        

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