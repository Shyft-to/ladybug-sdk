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
import { splDiscriminate } from "@solana/spl-type-length-value";
import {
	emitLayout,
	getAccountDataSizeLayout,
	metadataLayout,
	removeKeyLayout,
	updateAuthorityLayout,
	updateMetadataLayout,
} from "../decoders/layouts";

export function decodeToken2022Instruction(instruction: TransactionInstruction) {
    let discriminator = instruction.data[0];
    
    let decoded;
    switch(discriminator) {
        case TokenInstruction.InitializeMint: {
            const data = decodeInitializeMintInstructionUnchecked(instruction);
            decoded = {
                name: "initializeMint",
                data
            }
            break;
        }
        case TokenInstruction.InitializeAccount: {
            const data = decodeInitializeAccountInstruction(instruction, instruction.programId);
            decoded = {
                name: "initializeAccount",
                data
            }
            break;
        }
        case TokenInstruction.InitializeMultisig: {
            const data = decodeInitializeMultisigInstruction(instruction, instruction.programId);
            decoded = {
                name: "initializeMultisig",
                data
            }
            break;
        }
        case TokenInstruction.Transfer: {
            const data = decodeTransferInstruction(instruction, instruction.programId);
            decoded = {
                name: "transfer",
                data
            }
            break;
        }
        case TokenInstruction.Approve: {
            const data = decodeApproveInstruction(instruction, instruction.programId);
            decoded = {
                name: "approve",
                data
            }
            break;
        }
        case TokenInstruction.Revoke: {
            const data = decodeRevokeInstruction(instruction, instruction.programId);
            decoded = {
                name: "revoke",
                data
            }
            break;
        }
        case TokenInstruction.SetAuthority: {
            const data = decodeSetAuthorityInstruction(instruction, instruction.programId);
            decoded = {
                name: "setAuthority",
                data
            }
            break;
        }
        case TokenInstruction.MintTo: {
            const data = decodeMintToInstruction(instruction, instruction.programId);
            decoded = {
                name: "mintTo",
                data
            }
            break;
        }
        case TokenInstruction.Burn: {
            const data = decodeBurnInstruction(instruction, instruction.programId);
            decoded = {
                name: "burn",
                data
            }
            break;
        }
        case TokenInstruction.CloseAccount: {
            const data = decodeCloseAccountInstruction(instruction, instruction.programId);
            decoded = {
                name: "closeAccount",
                data
            }
            break;
        }
        case TokenInstruction.FreezeAccount: {
            const data = decodeFreezeAccountInstruction(instruction, instruction.programId);
            decoded = {
                name: "freezeAccount",
                data
            }
            break;
        }
        case TokenInstruction.ThawAccount: {
            const data = decodeThawAccountInstruction(instruction, instruction.programId);
            decoded = {
                name: "thawAccount",
                data
            }
            break;
        }
        case TokenInstruction.TransferChecked: {
            const data = decodeTransferCheckedInstruction(instruction, instruction.programId);
            decoded = {
                name: "transferChecked",
                data
            }
            break;
        }
        case TokenInstruction.ApproveChecked: {
            const data = decodeApproveCheckedInstruction(instruction, instruction.programId);
            decoded = {
                name: "approveChecked",
                data
            }
            break;
        }
        case TokenInstruction.BurnChecked: {
            const data = decodeBurnCheckedInstruction(instruction, instruction.programId);
            decoded = {
                name: "burnChecked",
                data
            }
            break;
        }
        case TokenInstruction.InitializeAccount2: {
            const data = decodeInitializeAccount2Instruction(instruction, instruction.programId);
            decoded = {
                name: "initializeAccount2",
                data
            }
            break;
        }
        case TokenInstruction.SyncNative: {
            decoded = {name: "syncNative"}
            break;
        }
        case TokenInstruction.InitializeAccount3: {
            const data = decodeInitializeAccount3Instruction(instruction, instruction.programId);
            decoded = {
                name: "initializeAccount3",
                data
            }
            break;
        }
        case TokenInstruction.InitializeMint2: {
            const data = decodeInitializeMint2Instruction(instruction, instruction.programId);
            decoded = {
                name: "initializeMint2",
                data
            }
            break;
        }
        case TokenInstruction.GetAccountDataSize: {
            const data = {name: "getAccountDataSize"}
            decoded = {
                name: "getAccountDataSize",
                data
            }
            break;
        }
        case TokenInstruction.InitializeImmutableOwner: {
            const data = decodeInitializeImmutableOwnerInstruction(instruction, instruction.programId);
            decoded = {
                name: "initializeImmutableOwner",
                data
            }
            break;
        }
        case TokenInstruction.AmountToUiAmount: {
            const data = decodeAmountToUiAmountInstruction(instruction, instruction.programId);
            decoded = {
                name: "amountToUiAmount",
                data
            }
            break;
        }
        case TokenInstruction.UiAmountToAmount: {
            const data = decodeUiAmountToAmountInstruction(instruction, instruction.programId);
            decoded = {
                name: "uiAmountToAmount",
                data
            }
            break;
        }
        case TokenInstruction.InitializeMintCloseAuthority: {
            const data = decodeInitializeMintCloseAuthorityInstruction(instruction, instruction.programId);
            decoded = {
                name: "initializeMintCloseAuthority",
                data
            }
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
                    const data = decodeInitializeTransferFeeConfigInstruction(instruction, instruction.programId);
                    decoded = {
                        name: "initializeTransferFeeConfig",
                        data
                    }
                    break;
                }
                case TransferFeeInstruction.TransferCheckedWithFee: {
                    const data = decodeTransferCheckedWithFeeInstruction(instruction, instruction.programId);
                    decoded = {
                        name: "transferCheckedWithFee",
                        data
                    }
                    break;
                }
                case TransferFeeInstruction.WithdrawWithheldTokensFromMint: {
                    const data = decodeWithdrawWithheldTokensFromMintInstruction(instruction, instruction.programId);
                    decoded = {
                        name: "withdrawWithheldTokensFromMint",
                        data
                    }
                    break;
                }
                case TransferFeeInstruction.WithdrawWithheldTokensFromAccounts: {
                    const data = decodeWithdrawWithheldTokensFromAccountsInstruction(instruction, instruction.programId);
                    decoded = {
                        name: "withdrawWithheldTokensFromAccounts",
                        data
                    }
                    break;
                }
                case TransferFeeInstruction.HarvestWithheldTokensToMint: {
                    const data = decodeHarvestWithheldTokensToMintInstruction(instruction, instruction.programId);
                    decoded = {
                        name: "harvestWithheldTokensToMint",
                        data
                    }
                    break;
                }
                case TransferFeeInstruction.SetTransferFee: {
                    const data = decodeSetTransferFeeInstruction(instruction, instruction.programId);
                    decoded = {
                        name: "setTransferFee",
                        data
                    }
                    break;
                }
                default: {
					decoded = null;
					break;
				} 
            }
            break;
        }
        case TokenInstruction.DefaultAccountStateExtension: {
            const subDiscriminator = instruction.data[1];
            switch (subDiscriminator) {
                case DefaultAccountStateInstruction.Initialize: {
                    const data = defaultAccountStateInstructionData.decode(instruction.data);
                    decoded = {
                        name: "TokenInitialize",
                        data
                    }
                    break;
                }
                case DefaultAccountStateInstruction.Update: {
                    const data = defaultAccountStateInstructionData.decode(instruction.data);
                    decoded = {
                        name: "TokenUpdate",
                        data
                    }
                    break;
                }
                default: {
                    decoded = {
                        name: "unknown",
                        data: null
                    };
                    break;
                }
            }
            break;
        }
        case TokenInstruction.MemoTransferExtension: {
            const instructionData = memoTransferInstructionData.decode(instruction.data);
            const data = instructionData;
            decoded = {
                name: "memoTransfer",
                data
            }
            break;
        }
        case TokenInstruction.InitializeNonTransferableMint: {
            const data = {name: "initializeNonTransferableMint"}
            decoded = {
                name: "initializeNonTransferableMint",
                data
            }
            break;
        }
        case TokenInstruction.CpiGuardExtension: {
            const instructionData = cpiGuardInstructionData.decode(instruction.data);
            decoded = {
                name: "cpiGuard",
                data: instructionData
            }
            break;
        }
        case TokenInstruction.InitializePermanentDelegate: {
            const data = decodeInitializePermanentDelegateInstruction(instruction, instruction.programId);
            decoded = {
                name: "initializePermanentDelegate",
                data
            }
            break;
        }
        case TokenInstruction.TransferHookExtension: {
            const subDiscriminator = instruction.data[1];
            switch (subDiscriminator) {
                case TransferHookInstruction.Initialize: {
                    
                    const data = initializeTransferHookInstructionData.decode(instruction.data);
                    decoded = {
                        name: "initializeTransferHook",
                        data
                    }
                    break;
                }
                case TransferHookInstruction.Update: {
                    const data = updateTransferHookInstructionData.decode(instruction.data);
                    decoded = {
                        name: "updateTransferHook",
                        data
                    }
                    break;
                }
                default: {
                    decoded = {
                        name: "unknown",
                        data: null
                    };
                    break;
                }
            }
            break;
        }
        case TokenInstruction.MetadataPointerExtension: {
            const subDiscriminator = instruction.data[1];
            switch (subDiscriminator) {
                case MetadataPointerInstruction.Initialize: {
                    
                    const data = initializeMetadataPointerData.decode(instruction.data);
                    decoded = {
                        name: "initializeMetadataPointer",
                        data
                    }
                    // decoded = instructionData;
                    break;
                }
                case MetadataPointerInstruction.Update: {
                    const data = updateMetadataPointerData.decode(instruction.data);
                    decoded = {
                        name: "updateMetadataPointer",
                        data
                    }
                    break;
                }
                default: {
                    decoded = {
                        name: "unknown",
                        data: null
                    };
                    break;
                }
            }
            break;
        }
        case TokenInstruction.GroupMemberPointerExtension: {
            const discriminator = instruction.data[1];
            switch (discriminator) {
                case GroupMemberPointerInstruction.Initialize: {
                    const data = initializeGroupMemberPointerData.decode(instruction.data);
                    decoded = {
                        name: "initializeGroupMemberPointer",
                        data
                    }
                    break;
                }
                case GroupMemberPointerInstruction.Update: {
                    const data = updateGroupMemberPointerData.decode(instruction.data);
                    decoded = {
                        name: "updateGroupMemberPointer",
                        data
                    }
                    break;
                }
                default: {
                    const data = null;
                    decoded = {
                        name: "unknown",
                        data
                    }
                    break;
                }
            }
            break;
        }
        default: {
            const discriminator = instruction.data.slice(0, 8).toString("hex");
            const [splDiscriminateInit, splDiscriminateUpdating, splDiscriminateRemove, splDiscriminateUpdate, splDiscriminateEmitter] = [
                "spl_token_metadata_interface:initialize_account",
                "spl_token_metadata_interface:updating_field",
                "spl_token_metadata_interface:remove_key_ix",
                "spl_token_metadata_interface:update_the_authority",
                "spl_token_metadata_interface:emitter",
            ].map((s) => splDiscriminate(s));

            switch (discriminator) {
                case splDiscriminateInit.toString(): {
                    const metadata = metadataLayout.decode(instruction.data);
                    decoded = {
                        name: "initializeMetadata",
                        data: metadata
                    }
                    break;
                }
                case splDiscriminateUpdating.toString(): {
                    const data = updateMetadataLayout.decode(instruction.data);
                    decoded = {
                        name: "updateField",
                        data,
                    };
                    break;
                }
                case splDiscriminateRemove.toString(): {
                    const data = removeKeyLayout.decode(instruction.data);
                    decoded = {
                        name: "removeKey",
                        data
                    }
                    break;
                }
                case splDiscriminateUpdate.toString(): {
                    const data = updateAuthorityLayout.decode(instruction.data);
                    decoded = {
                        name: "updateAuthority",
                        data
                    }
                    break;
                }
                case splDiscriminateEmitter.toString(): {
                    const data = emitLayout.decode(instruction.data);
                    decoded = {
                        name: "emit",
                        data
                    }
                    break;
                }
                default:
                    decoded = {
                        name: "unknown",
                        data: null
                    };
            }
            break;
        }
    }

    return decoded;
}