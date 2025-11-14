import { BN } from "@coral-xyz/anchor";
import { TransactionInstruction, SystemInstruction, SystemProgram, Connection } from "@solana/web3.js";
import { SystemProgram as SystemProgramIdl } from "@coral-xyz/anchor";

export function decodeSystemInstruction(instruction: TransactionInstruction) {
    try {
        const ixType = SystemInstruction.decodeInstructionType(instruction);
        let decoded;
        switch (ixType) {
            case "AdvanceNonceAccount": {
                const decodedInstr = SystemInstruction.decodeNonceAdvance(instruction);
                decoded = {
                    name: "advanceNonceAccount",
                    data: decodedInstr,
                }
                break;
            }
            case "Allocate": {
                const decodedInstr = SystemInstruction.decodeAllocate(instruction);
                decoded = {
                    name: "allocate",
                    data: decodedInstr,
                }
                break;
            }
            case "AllocateWithSeed": {
                const decodedInstr = SystemInstruction.decodeAllocateWithSeed(instruction);
                decoded = {
                    name: "allocateWithSeed",
                    data: decodedInstr,
                }
                break;
            }
            case "Assign": {
                const decodedInstr = SystemInstruction.decodeAssign(instruction);
                decoded = {
                    name: "assign",
                    data: decodedInstr,
                }
                break;
            }
            case "AssignWithSeed": {
                const decodedInstr = SystemInstruction.decodeAssignWithSeed(instruction);
                decoded = {
                    name: "assignWithSeed",
                    data: decodedInstr,
                }
                break;
            }
            case "AuthorizeNonceAccount": {
                const decodedInstr = SystemInstruction.decodeNonceAuthorize(instruction);
                decoded = {
                    name: "authorizeNonceAccount",
                    data: decodedInstr,
                }
                break;
            }
            case "Create": {
                const decodedInstr = SystemInstruction.decodeCreateAccount(instruction);
                decoded = {
                    name: "create",
                    data: decodedInstr,
                }
                break;
            }
            case "CreateWithSeed": {
                const decodedInstr = SystemInstruction.decodeCreateWithSeed(instruction);
                decoded = {
                    name: "createWithSeed",
                    data: decodedInstr,
                }
                break;
            }
            case "InitializeNonceAccount": {
                const decodedInstr = SystemInstruction.decodeNonceInitialize(instruction);
                decoded = {
                    name: "initializeNonceAccount",
                    data: decodedInstr,
                }
                break;
            }
            case "Transfer": {
                const decodedInstr = SystemInstruction.decodeTransfer(instruction);
                decoded = {
                    name: "transfer",
                    data: decodedInstr,
                }
                break;
            }
            case "TransferWithSeed": {
                const decodedInstr = SystemInstruction.decodeTransferWithSeed(instruction);
                decoded = {
                    name: "transferWithSeed",
                    data: decodedInstr,
                }
                break;
            }
            case "WithdrawNonceAccount": {
                const decodedInstr = SystemInstruction.decodeNonceWithdraw(instruction);
                decoded = {
                    name: "withdrawNonceAccount",
                    data: decodedInstr,
                }
                break;
            }
            default: {
                decoded = {
                    programId: SystemProgram.programId,
                    name: "unknown",
                    accounts: instruction.keys,
                    args: { unknown: instruction.data },
                }
            }  
        }
        return decoded;
    } catch (error) {
        console.log("Error Decoding System Instruction: ", error);
        return {
            programId: SystemProgram.programId,
            name: "unknown",
            accounts: instruction.keys,
            args: { unknown: instruction.data },
        }
    }
    
}