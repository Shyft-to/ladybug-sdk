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


export function decodeTokenInstruction(
    instruction: any
) {
    const decoded = instruction.data[0];

    switch (decoded) {
        case TokenInstruction.InitializeAccount:
            return decodeInitializeAccountInstruction(instruction);
        case TokenInstruction.InitializeAccount2:
            return decodeInitializeAccount2Instruction(instruction);
        case TokenInstruction.InitializeAccount3:
            return decodeInitializeAccount3Instruction(instruction);
        case TokenInstruction.InitializeMint:
            return decodeInitializeMintInstructionUnchecked(instruction);
        case TokenInstruction.InitializeMint2:
            return decodeInitializeMint2Instruction(instruction);
        case TokenInstruction.InitializeMultisig:
            return decodeInitializeMultisigInstruction(instruction);
        case TokenInstruction.Transfer:
            return decodeTransferInstruction(instruction);
        case TokenInstruction.TransferChecked:
            return decodeTransferCheckedInstruction(instruction);
        case TokenInstruction.Approve:
            return decodeApproveInstruction(instruction);
        case TokenInstruction.ApproveChecked:
            return decodeApproveCheckedInstruction(instruction);
        case TokenInstruction.Revoke:
            return decodeRevokeInstruction(instruction);
        case TokenInstruction.SetAuthority:
            return decodeSetAuthorityInstruction(instruction);
        case TokenInstruction.MintTo:
            return decodeMintToInstruction(instruction);
        case TokenInstruction.MintToChecked:
            return decodeMintToCheckedInstruction(instruction);
        case TokenInstruction.Burn:
            return decodeBurnInstruction(instruction);
        case TokenInstruction.BurnChecked:
            return decodeBurnCheckedInstruction(instruction);
        case TokenInstruction.CloseAccount:
            return decodeCloseAccountInstruction(instruction);
        case TokenInstruction.FreezeAccount:
            return decodeFreezeAccountInstruction(instruction);
        case TokenInstruction.ThawAccount:
            return decodeThawAccountInstruction(instruction);
        case TokenInstruction.SyncNative:
            return decodeSyncNativeInstruction(instruction);
        case TokenInstruction.AmountToUiAmount:
            return decodeAmountToUiAmountInstruction(instruction);
        case TokenInstruction.UiAmountToAmount:
            return decodeUiAmountToAmountInstruction(instruction);
    }
}