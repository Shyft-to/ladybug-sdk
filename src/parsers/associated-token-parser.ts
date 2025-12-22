import { PublicKey, TransactionInstruction } from '@solana/web3.js';

enum AssociatedTokenInstructionType {
    Create = 0,
    CreateIdempotent = 1,
    RecoverNested = 2,
}

export function decodeAssociatedTokenInstruction(instruction: TransactionInstruction) {

    let type: AssociatedTokenInstructionType;
    if (instruction.data.length === 0) {
        type = AssociatedTokenInstructionType.Create;
    } else {
        type = instruction.data[0] as AssociatedTokenInstructionType;
    }

    switch (type) {
        case AssociatedTokenInstructionType.Create:
        case AssociatedTokenInstructionType.CreateIdempotent:
            return {
                name: type === 0 ? "Create" : "CreateIdempotent",
                accounts: {
                    funder: instruction.keys[0]?.pubkey,
                    ata: instruction.keys[1]?.pubkey,
                    wallet: instruction.keys[2]?.pubkey,
                    mint: instruction.keys[3]?.pubkey,
                    systemProgram: instruction.keys[4]?.pubkey,
                    tokenProgram: instruction.keys[5]?.pubkey,
                }
            };

        case AssociatedTokenInstructionType.RecoverNested:
            return {
                name: "RecoverNested",
                accounts: {
                    nestedAta: instruction.keys[0]?.pubkey,
                    nestedMint: instruction.keys[1]?.pubkey,
                    destinationAta: instruction.keys[2]?.pubkey,
                    ownerAta: instruction.keys[3]?.pubkey,
                    ownerMint: instruction.keys[4]?.pubkey,
                    wallet: instruction.keys[5]?.pubkey,
                    tokenProgram: instruction.keys[6]?.pubkey,
                    // Required for consistency in the return type
                    ata: instruction.keys[0]?.pubkey,
                }
            };

        default:
            throw new Error(`Unknown ATP Instruction byte: ${type}`);
    }
}