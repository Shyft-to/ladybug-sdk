import {
    AuthorityType,
    TOKEN_PROGRAM_ID,
    TokenInstruction,
    decodeApproveCheckedInstruction,
    decodeApproveInstruction,
    decodeBurnCheckedInstruction,
    decodeBurnInstruction,
    decodeCloseAccountInstruction,
    decodeFreezeAccountInstruction,
    decodeInitializeAccountInstruction,
    decodeInitializeMintInstructionUnchecked,
    decodeInitializeMultisigInstruction,
    decodeMintToCheckedInstruction,
    decodeMintToInstruction,
    decodeRevokeInstruction,
    decodeSetAuthorityInstruction,
    decodeThawAccountInstruction,
    decodeTransferCheckedInstruction,
    decodeTransferInstruction,
    decodeAmountToUiAmountInstruction,
    decodeInitializeAccount2Instruction,
    decodeInitializeAccount3Instruction,
    decodeInitializeMint2Instruction,
    decodeInitializeImmutableOwnerInstruction,
    decodeSyncNativeInstruction,
    decodeUiAmountToAmountInstruction,
} from "@solana/spl-token";
import { TransactionInstruction } from "@solana/web3.js";


export function decodeTokenInstruction(
    instruction: TransactionInstruction
) {
    try {
        const discriminator = instruction.data[0];
        let parsed;
        switch (discriminator) {
            case TokenInstruction.InitializeAccount: {
                const decodedInsr = decodeInitializeAccountInstruction(instruction, instruction.programId);
                parsed = {
                    name: "initializeAccount",
                    data: decodedInsr
                }
                break;
            }
            case TokenInstruction.InitializeAccount2:
                {
                    const decodedInsr = decodeInitializeAccount2Instruction(instruction, instruction.programId);
                    parsed = {
                        name: "initializeAccount2",
                        data: decodedInsr
                    }
                    break;
                }
            case TokenInstruction.InitializeAccount3:
                {
                    const decodedInsr = decodeInitializeAccount3Instruction(instruction, instruction.programId);
                    parsed = {
                        name: "initializeAccount3",
                        data: decodedInsr
                    }
                    break;
                }
            case TokenInstruction.InitializeMint:
                {
                    const decodedInsr = decodeInitializeMintInstructionUnchecked(instruction);
                    parsed = {
                        name: "initializeMint",
                        data: decodedInsr
                    }
                    break;
                }
            case TokenInstruction.InitializeMint2:
                {
                    const decodedInsr = decodeInitializeMint2Instruction(instruction, instruction.programId);
                    parsed = {
                        name: "initializeMint2",
                        data: decodedInsr
                    }
                    break;
                }
            case TokenInstruction.InitializeMultisig:
                {
                    const decodedInsr = decodeInitializeMultisigInstruction(instruction, instruction.programId);
                    parsed = {
                        name: "initializeMultisig",
                        data: decodedInsr
                    }
                    break;
                }
            case TokenInstruction.Transfer:
                {
                    const decodedInsr = decodeTransferInstruction(instruction, instruction.programId);
                    parsed = {
                        name: "transfer",
                        data: decodedInsr
                    }
                    break;
                }
            case TokenInstruction.TransferChecked:
                {
                    const decodedInsr = decodeTransferCheckedInstruction(instruction, instruction.programId);
                    parsed = {
                        name: "transferChecked",
                        data: decodedInsr
                    }
                    break;
                }
            case TokenInstruction.Approve:
                {
                    const decodedInsr = decodeApproveInstruction(instruction, instruction.programId);
                    parsed = {
                        name: "approve",
                        data: decodedInsr
                    }
                    break;
                }
            case TokenInstruction.ApproveChecked:
                {
                    const decodedInsr = decodeApproveCheckedInstruction(instruction, instruction.programId);
                    parsed = {
                        name: "approveChecked",
                        data: decodedInsr
                    }
                    break;
                }
            case TokenInstruction.Revoke:
                {
                    const decodedInsr = decodeRevokeInstruction(instruction, instruction.programId);
                    parsed = {
                        name: "revoke",
                        data: decodedInsr
                    }
                    break;
                }
            case TokenInstruction.SetAuthority:
                {
                    const decodedInsr = decodeSetAuthorityInstruction(instruction, instruction.programId);
                    parsed = {
                        name: "setAuthority",
                        data: decodedInsr
                    }
                    break;
                }
            case TokenInstruction.MintTo:
                {
                    const decodedInsr = decodeMintToInstruction(instruction, instruction.programId);
                    parsed = {
                        name: "mintTo",
                        data: decodedInsr
                    }
                    break;
                }
            case TokenInstruction.MintToChecked:
                {
                    const decodedInsr = decodeMintToCheckedInstruction(instruction, instruction.programId);
                    parsed = {
                        name: "mintToChecked",
                        data: decodedInsr
                    }
                    break;
                }
            case TokenInstruction.Burn:
                {
                    const decodedInsr = decodeBurnInstruction(instruction, instruction.programId);
                    parsed = {
                        name: "burn",
                        data: decodedInsr
                    }
                    break;
                }
            case TokenInstruction.BurnChecked:
                {
                    const decodedInsr = decodeBurnCheckedInstruction(instruction, instruction.programId);
                    parsed = {
                        name: "burnChecked",
                        data: decodedInsr
                    }
                    break;
                }
            case TokenInstruction.CloseAccount:
                {
                    const decodedInsr = decodeCloseAccountInstruction(instruction, instruction.programId);
                    parsed = {
                        name: "closeAccount",
                        data: decodedInsr
                    }
                    break;
                }
            case TokenInstruction.FreezeAccount:
                {
                    const decodedInsr = decodeFreezeAccountInstruction(instruction, instruction.programId);
                    parsed = {
                        name: "freezeAccount",
                        data: decodedInsr
                    }
                    break;
                }
            case TokenInstruction.ThawAccount:
                {
                    const decodedInsr = decodeThawAccountInstruction(instruction, instruction.programId);
                    parsed = {
                        name: "thawAccount",
                        data: decodedInsr
                    }
                    break;
                }
            case TokenInstruction.SyncNative:
                {
                    const decodedInsr = decodeSyncNativeInstruction(instruction, instruction.programId);
                    parsed = {
                        name: "syncNative",
                        data: decodedInsr
                    }
                    break;
                }
            case TokenInstruction.AmountToUiAmount:
                {
                    const decodedInsr = decodeAmountToUiAmountInstruction(instruction, instruction.programId);
                    parsed = {
                        name: "amountToUiAmount",
                        data: decodedInsr
                    }
                }
            case TokenInstruction.UiAmountToAmount:
                {
                    const decodedInsr = decodeUiAmountToAmountInstruction(instruction, instruction.programId);
                    parsed = {
                        name: "uiAmountToAmount",
                        data: decodedInsr
                    }
                    break;
                }
            default: {
                parsed = {
                    name: "unknown",
                    data: {}
                }
                break;
            }
        }
        return parsed;
    } catch (error) {
        console.log("Error decoding token instruction: ", error);
        return {
            name: "unknown",
            data: {}
        }
    }

}