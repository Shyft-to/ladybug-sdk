import { BN } from "@coral-xyz/anchor";
import { TransactionInstruction, SystemInstruction, SystemProgram, Connection } from "@solana/web3.js";
import { SystemProgram as SystemProgramIdl } from "@coral-xyz/anchor";

export function decodeSystemInstruction(instruction: TransactionInstruction) {
    const ixType = SystemInstruction.decodeInstructionType(instruction);
    let decoded;
    switch (ixType) {
        case "AdvanceNonceAccount": {
            decoded = SystemInstruction.decodeNonceAdvance(instruction);
            break;
        }
        case "Allocate": {
            decoded = SystemInstruction.decodeAllocate(instruction);
            break;
        }
        case "AllocateWithSeed": {
            decoded = SystemInstruction.decodeAllocateWithSeed(instruction);
            break;
        }
        case "Assign": {
            decoded = SystemInstruction.decodeAssign(instruction);
            break;
        }
        case "AssignWithSeed": {
            decoded = SystemInstruction.decodeAssignWithSeed(instruction);
            break;
        }
        case "AuthorizeNonceAccount": {
            decoded = SystemInstruction.decodeNonceAuthorize(instruction);
            break;
        }
        case "Create": {
            decoded = SystemInstruction.decodeCreateAccount(instruction);
            break;
        }
        case "CreateWithSeed": {
            decoded = SystemInstruction.decodeCreateWithSeed(instruction);
            break;
        }
        case "InitializeNonceAccount": {
            decoded = SystemInstruction.decodeNonceInitialize(instruction);
            break;
        }
        case "Transfer": {
            decoded = SystemInstruction.decodeTransfer(instruction);
            break;
        }
        case "TransferWithSeed": {
            decoded = SystemInstruction.decodeTransferWithSeed(instruction);
            break;
        }
        case "WithdrawNonceAccount": {
            decoded = SystemInstruction.decodeNonceWithdraw(instruction);
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
        return decoded;
    }
}