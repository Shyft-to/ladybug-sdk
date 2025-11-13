import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
	AuthorityType,
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
	decodeInitializeMintCloseAuthorityInstruction,
	decodeUiAmountToAmountInstruction,
	TOKEN_2022_PROGRAM_ID,
	ExtensionType,
	TransferFeeInstruction,
	decodeInitializeTransferFeeConfigInstruction,
	decodeTransferCheckedWithFeeInstruction,
	decodeWithdrawWithheldTokensFromMintInstruction,
	decodeWithdrawWithheldTokensFromAccountsInstruction,
	decodeHarvestWithheldTokensToMintInstruction,
	DefaultAccountStateInstruction,
	AccountState,
	defaultAccountStateInstructionData,
	memoTransferInstructionData,
	MemoTransferInstruction,
	cpiGuardInstructionData,
	CpiGuardInstruction,
	decodeInitializePermanentDelegateInstruction,
	TransferHookInstruction,
	initializeTransferHookInstructionData,
	updateTransferHookInstructionData,
	MetadataPointerInstruction,
	initializeMetadataPointerData,
	updateMetadataPointerData,
	GroupPointerInstruction,
	initializeGroupPointerData,
	updateGroupPointerData,
	GroupMemberPointerInstruction,
	initializeGroupMemberPointerData,
	updateGroupMemberPointerData,
	decodeSetTransferFeeInstruction,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { splDiscriminate } from "@solana/spl-type-length-value";

export function decodeToken2022Instruction(instruction: TransactionInstruction) {
    const discriminator = instruction.data[0];
    let decoded;
    switch(discriminator) {
        case TokenInstruction.InitializeMint: {
            decoded = decodeInitializeMintInstructionUnchecked(instruction);
            break;
        }
        case TokenInstruction.InitializeAccount: {
            decoded = decodeInitializeAccountInstruction(instruction);
            break;
        }
        case TokenInstruction.InitializeMultisig: {
            decoded = decodeInitializeMultisigInstruction(instruction);
            break;
        }
        case TokenInstruction.Transfer: {
            decoded = decodeTransferInstruction(instruction);
            break;
        }
        case TokenInstruction.Approve: {
            decoded = decodeApproveInstruction(instruction);
            break;
        }
        case TokenInstruction.Revoke: {
            decoded = decodeRevokeInstruction(instruction);
            break;
        }
        case TokenInstruction.SetAuthority: {
            decoded = decodeSetAuthorityInstruction(instruction);
            break;
        }
        case TokenInstruction.MintTo: {
            decoded = decodeMintToInstruction(instruction);
            break;
        }
        case TokenInstruction.Burn: {
            decoded = decodeBurnInstruction(instruction);
            break;
        }
        case TokenInstruction.CloseAccount: {
            decoded = decodeCloseAccountInstruction(instruction);
            break;
        }
        case TokenInstruction.FreezeAccount: {
            decoded = decodeFreezeAccountInstruction(instruction);
            break;
        }
        case TokenInstruction.ThawAccount: {
            decoded = decodeThawAccountInstruction(instruction);
            break;
        }
        case TokenInstruction.TransferChecked: {
            decoded = decodeTransferCheckedInstruction(instruction);
            break;
        }
        case TokenInstruction.ApproveChecked: {
            decoded = decodeApproveCheckedInstruction(instruction);
            break;
        }
        case TokenInstruction.BurnChecked: {
            decoded = decodeBurnCheckedInstruction(instruction);
            break;
        }
        case TokenInstruction.InitializeAccount2: {
            decoded = decodeInitializeAccount2Instruction(instruction);
            break;
        }
        case TokenInstruction.SyncNative: {
            decoded = {name: "syncNative"}
            break;
        }
        case TokenInstruction.InitializeAccount3: {
            decoded = decodeInitializeAccount3Instruction(instruction);
            break;
        }
        case TokenInstruction.InitializeMint2: {
            decoded = decodeInitializeMint2Instruction(instruction);
            break;
        }
        case TokenInstruction.GetAccountDataSize: {
            decoded = {name: "getAccountDataSize"}
            break;
        }
        case TokenInstruction.InitializeImmutableOwner: {
            decoded = decodeInitializeImmutableOwnerInstruction(instruction, TOKEN_2022_PROGRAM_ID);
            break;
        }
        case TokenInstruction.AmountToUiAmount: {
            decoded = decodeAmountToUiAmountInstruction(instruction, TOKEN_2022_PROGRAM_ID);
            break;
        }
        case TokenInstruction.InitializeMintCloseAuthority: {
            decoded = decodeInitializeMintCloseAuthorityInstruction(instruction, TOKEN_2022_PROGRAM_ID);
            break;
        }
        case TokenInstruction.CreateNativeMint: {
            decoded = {name: "createNativeMint"}
            break;
        }
        case TokenInstruction.TransferFeeExtension: {
			const subDiscriminator = instruction.data[1];
            switch (subDiscriminator) {
                case TransferFeeInstruction.InitializeTransferFeeConfig: {
                    decoded = decodeInitializeTransferFeeConfigInstruction(instruction, TOKEN_2022_PROGRAM_ID);
                    break;
                }
                case TransferFeeInstruction.TransferCheckedWithFee: {
                    decoded = decodeTransferCheckedWithFeeInstruction(instruction, TOKEN_2022_PROGRAM_ID);
                    break;
                }
                case TransferFeeInstruction.WithdrawWithheldTokensFromMint: {
                    decoded = decodeWithdrawWithheldTokensFromMintInstruction(instruction, TOKEN_2022_PROGRAM_ID);
                    break;
                }
                case TransferFeeInstruction.WithdrawWithheldTokensFromAccounts: {
                    decoded = decodeWithdrawWithheldTokensFromAccountsInstruction(instruction, TOKEN_2022_PROGRAM_ID);
                    break;
                }
                case TransferFeeInstruction.HarvestWithheldTokensToMint: {
                    decoded = decodeHarvestWithheldTokensToMintInstruction(instruction, TOKEN_2022_PROGRAM_ID);
                    break;
                }
                case TransferFeeInstruction.SetTransferFee: {
                    decoded = decodeSetTransferFeeInstruction(instruction, TOKEN_2022_PROGRAM_ID);
                    break;
                }
                default: {
					decoded = null;
					break;
				} 
            }
        }
        case TokenInstruction.DefaultAccountStateExtension: {
            const subDiscriminator = instruction.data[1];
            switch (subDiscriminator) {
                case DefaultAccountStateInstruction.Initialize: {
                    decoded = defaultAccountStateInstructionData.decode(instruction.data);
                    break;
                }
                case DefaultAccountStateInstruction.Update: {
                    decoded = defaultAccountStateInstructionData.decode(instruction.data);
                    break;
                }
                default: {
                    decoded = null;
                    break;
                }
            }
            break;
        }
        case TokenInstruction.MemoTransferExtension: {
            const instructionData = memoTransferInstructionData.decode(instruction.data);
            decoded = instructionData;
            break;
        }
        case TokenInstruction.InitializeNonTransferableMint: {
            decoded = {name: "initializeNonTransferableMint"}
            break;
        }
        case TokenInstruction.CpiGuardExtension: {
            const instructionData = cpiGuardInstructionData.decode(instruction.data);
            decoded = instructionData;
            break;
        }
        case TokenInstruction.InitializePermanentDelegate: {
            decoded = decodeInitializePermanentDelegateInstruction(instruction, TOKEN_2022_PROGRAM_ID);
            break;
        }
        case TokenInstruction.TransferHookExtension: {
            const subDiscriminator = instruction.data[1];
            switch (subDiscriminator) {
                case TransferHookInstruction.Initialize: {
                    
                    decoded = initializeTransferHookInstructionData.decode(instruction.data);
                    break;
                }
                case TransferHookInstruction.Update: {
                    decoded = updateTransferHookInstructionData.decode(instruction.data);
                    break;
                }
                default: {
                    decoded = null;
                    break;
                }
            }
            break;
        }
        case TokenInstruction.MetadataPointerExtension: {
            const subDiscriminator = instruction.data[1];
            switch (subDiscriminator) {
                case MetadataPointerInstruction.Initialize: {
                    
                    decoded = initializeMetadataPointerData.decode(instruction.data);
                    // decoded = instructionData;
                    break;
                }
                case MetadataPointerInstruction.Update: {
                    decoded = updateMetadataPointerData.decode(instruction.data);
                    break;
                }
                default: {
                    decoded = null;
                    break;
                }
            }
            break;
        }
        case TokenInstruction.GroupMemberPointerExtension: {
            const discriminator = instruction.data[1];
            switch (discriminator) {
                case GroupMemberPointerInstruction.Initialize: {
                    decoded = initializeGroupMemberPointerData.decode(instruction.data);
                    break;
                }
                case GroupMemberPointerInstruction.Update: {
                    decoded = updateGroupMemberPointerData.decode(instruction.data);
                    break;
                }
                default: {
                    decoded = null;
                    break;
                }
            }
            break;
        }
        default: {
            decoded = null;
            break;
        }
    
    }

    return decoded;
}