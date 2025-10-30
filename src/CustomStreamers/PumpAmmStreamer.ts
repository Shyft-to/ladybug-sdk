import {
  CommitmentLevel,
  SubscribeRequest,
} from "@triton-one/yellowstone-grpc";
import Client from "@triton-one/yellowstone-grpc";
import { Parser } from "../Parsers/Parser";
import pumpIdl from "../IdlFiles/pump_amm_0.1.0.json";
import { PublicKey } from "@solana/web3.js";
import { Idl } from "@coral-xyz/anchor";

type instructionType = "buy" | "sell" | "newPool" | "tokenMigration";

type TransactionTypeCallbacks = {
  buy: (tx: any) => void;
  sell: (tx: any) => void;
  newPool: (tx: any) => void;
  tokenMigration: (tx: any) => void;
};

export class PumpAmmStreamer {
  private client: Client;
  private request: SubscribeRequest;
  private pumpAmmAddress: string =
    "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
  private addresses: [string] = [this.pumpAmmAddress];
  private running: boolean = false;
  private stream?: any;
  private parser: Parser;
  private transactionRunning = false;
  private accountRunning = false;

  private transactionStream?: any;
  private accountStream?: any;

  private onDataCallback?: (data: any) => void;
  private onErrorCallback?: (err: any) => void;
  private onEndCallback?: () => void;
  private onCloseCallback?: () => void;
  private onTransactionCallback?: (tx: any) => void;
  private onAccountCallback?: (acc: any) => void;
  private onDetectedTypeCallbacks: Partial<TransactionTypeCallbacks> = {};

  constructor(endpoint: string, xToken?: string) {
    this.client = new Client(endpoint, xToken, undefined);

    const parser = new Parser();
    parser.addIDL(new PublicKey(this.addresses[0]), pumpIdl as Idl);
    this.parser = parser;

    this.request = {
      accounts: {},
      slots: {},
      transactions: {
        pumpFun: {
          vote: false,
          failed: false,
          signature: undefined,
          accountInclude: this.addresses,
          accountExclude: [],
          accountRequired: [],
        },
      },
      transactionsStatus: {},
      entry: {},
      blocks: {},
      blocksMeta: {},
      accountsDataSlice: [],
      ping: undefined,
      commitment: CommitmentLevel.PROCESSED,
    };
  }

  // onData(callback: (data: any) => void) {
  //   this.onDataCallback = callback;
  // }

  onError(callback: (error: any) => void) {
    this.onErrorCallback = callback;
  }

  onEnd(callback: () => void) {
    this.onEndCallback = callback;
  }

  onClose(callback: () => void) {
    this.onCloseCallback = callback;
  }

  onTransaction(callback: (tx: any) => void) {
    this.onTransactionCallback = callback;
  }

  onAccount(callback: (acc: any) => void) {
    this.onAccountCallback = callback;
  }

  onDetectedTransactionType<T extends keyof TransactionTypeCallbacks>(
    type: T,
    callback: TransactionTypeCallbacks[T]
  ) {
    this.onDetectedTypeCallbacks[type] = callback;
  }

  private async pushUpdate() {
    if (!this.stream) return;

    await new Promise<void>((resolve, reject) => {
      this.stream!.write(this.request, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async start() {
    this.running = true;
    while (this.running) {
      try {
        await this.handleStream();
      } catch (error) {
        console.error("Stream error, retrying in 1s...", error);
        if (!this.running) break;
        await new Promise((res) => setTimeout(res, 1000));
      }
    }
  }

  async startStreamingTransactions() {
    this.transactionRunning = true;
    let retryDelay = 1000;

    while (this.transactionRunning) {
      try {
        console.log("Starting transaction stream...");
        await this.handleTransactionStream();

        // reset retry delay on successful run
        retryDelay = 1000;
        console.log("Transaction stream ended, reconnecting cleanly...");
      } catch (error) {
        console.error("Transaction stream error:", error);

        if (!this.transactionRunning) break;

        console.log(
          `⏳ Retrying transaction stream in ${retryDelay / 1000}s...`
        );
        await new Promise((res) => setTimeout(res, retryDelay));
        retryDelay = Math.min(retryDelay * 2, 30000);
      }
    }
  }

  stopStreamingTransactions() {
    console.log("Stopping transaction stream...");
    this.transactionRunning = false;
    this.transactionStream?.cancel();
    this.transactionStream = undefined;
  }

  async startStreamingAccounts() {
    this.accountRunning = true;
    let retryDelay = 1000;

    while (this.accountRunning) {
      try {
        console.log("Starting account stream...");
        await this.handleAccountStream();

        retryDelay = 1000;
        console.log("Account stream ended, reconnecting cleanly...");
      } catch (error) {
        console.error("Account stream error:", error);

        if (!this.accountRunning) break;

        console.log(`⏳ Retrying account stream in ${retryDelay / 1000}s...`);
        await new Promise((res) => setTimeout(res, retryDelay));
        retryDelay = Math.min(retryDelay * 2, 30000);
      }
    }
  }

  stopStreamingAccounts() {
    console.log("Stopping account stream...");
    this.accountRunning = false;
    this.accountStream?.cancel();
    this.accountStream = undefined;
  }

  private stop() {
    this.running = false;
    this.stream?.cancel();
    this.stream = undefined;
  }

  private async handleTransactionStream() {
    this.transactionStream = await this.client.subscribe();

    const streamClosed = new Promise<void>((resolve, reject) => {
      this.transactionStream.on("error", (err: any) => reject(err));
      this.transactionStream.on("end", resolve);
      this.transactionStream.on("close", resolve);
    });

    this.transactionStream.on("data", (data: any) => {
      try {
        if (data.transaction) {
          const formatted = this.parser.formatGrpcTransactionData(
            data.transaction,
            Date.now()
          );
          const parsed = this.parser.parseTransaction(formatted);

          if (this.onTransactionCallback) this.onTransactionCallback(parsed);

          this.detectAndTriggerTransactionType(parsed);
        }
      } catch (error) {
        if (this.onErrorCallback) this.onErrorCallback(error);
      }
    });

    // set request for transactions
    this.request = {
      ...this.request,
      accounts: {},
      transactions: {
        tracked: {
          vote: false,
          failed: false,
          signature: undefined,
          accountInclude: Array.from(this.addresses),
          accountExclude: [],
          accountRequired: [],
        },
      },
    };

    await this.pushUpdateTo(this.transactionStream);
    await streamClosed;
  }

  private async handleAccountStream() {
    this.accountStream = await this.client.subscribe();

    const streamClosed = new Promise<void>((resolve, reject) => {
      this.accountStream.on("error", (err: any) => {
        if (this.onErrorCallback) this.onErrorCallback(err);
        reject(err);
      });
      this.accountStream.on("end", () => {
        if (this.onEndCallback) this.onEndCallback();
        resolve();
      });
      this.accountStream.on("close", () => {
        if (this.onCloseCallback) this.onCloseCallback();
        resolve();
      });
    });

    this.accountStream.on("data", (data: any) => {
      try {
        if (data.account) {
          const decoded = this.parser.formatGeyserAccountData(data.account);
          const parsed = this.parser.parseAccount(decoded);

          if (this.onAccountCallback) {
            this.onAccountCallback(parsed);
          }
        }
      } catch (error) {
        if (this.onErrorCallback) this.onErrorCallback(error);
      }
    });

    this.request = {
      ...this.request,
      transactions: {},
      accounts: {
        program_name: {
          account: [],
          filters: [], 
          owner: Array.from(this.addresses),
        },
      },
    };

    await this.pushUpdateTo(this.accountStream);

    await streamClosed;
  }


  private async pushUpdateTo(stream: any) {
    if (!stream) return;
    await new Promise<void>((resolve, reject) => {
      stream.write(this.request, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async handleStream() {
    //console.log("Subscribing and starting stream...");
    //check if addresses not empty?
    this.stream = await this.client.subscribe();

    const streamClosed = new Promise<void>((resolve, reject) => {
      this.stream!.on("error", (err: any) => {
        if (this.onErrorCallback) this.onErrorCallback(err);
        reject(err);
        this.stream?.cancel();
      });
      this.stream!.on("end", () => {
        if (this.onEndCallback) this.onEndCallback();
        resolve();
      });
      this.stream!.on("close", () => {
        if (this.onCloseCallback) this.onCloseCallback();
        resolve();
      });
    });

    this.stream.on("data", (data: any) => {
      try {
        // if (!data.transaction) return;
        if (data.transaction) {
          const formatted = this.parser.formatGrpcTransactionData(
            data.transaction,
            Date.now()
          );
          const parsed = this.parser.parseTransaction(formatted);

          if (this.onTransactionCallback) this.onTransactionCallback(parsed);

          this.detectAndTriggerTransactionType(parsed);
        } else if (data.account) {
          const parsed = this.parser.parseAccount(data.account);
          if (this.onAccountCallback) this.onAccountCallback(parsed);
        }
      } catch (error) {
        if (this.onErrorCallback) this.onErrorCallback(error);
      }
    });

    await this.pushUpdate();
    await streamClosed;

    this.stream = undefined;
  }

  private detectAndTriggerTransactionType(tx: any) {
    try {
      if (
        this.onDetectedTypeCallbacks.tokenMigration &&
        this.isPumpAmmMigrationTransaction(tx)
      ) {
        this.onDetectedTypeCallbacks.tokenMigration(tx);
        return;
      }

      const createFound = this.newPoolTxn(tx);
      if (createFound && this.onDetectedTypeCallbacks.newPool) {
        this.onDetectedTypeCallbacks.newPool(tx);
        return;
      }

      const swap = this.parseSwapTransactionOutput(tx);
      if (swap) {
        if (swap.type === "buy" && this.onDetectedTypeCallbacks.buy) {
          this.onDetectedTypeCallbacks.buy(tx);
          return;
        }
        if (swap.type === "sell" && this.onDetectedTypeCallbacks.sell) {
          this.onDetectedTypeCallbacks.sell(tx);
          return;
        }
      }
    } catch (err) {
      if (this.onErrorCallback) this.onErrorCallback(err);
    }
  }

  private isPumpAmmMigrationTransaction(parsedTxn: any): boolean {
    if (!parsedTxn?.transaction?.message) return false;

    const message = parsedTxn.transaction.message;

    const instructions = message.instructions || message.compiledInstructions;

    if (!Array.isArray(instructions)) return false;

    const migrateFound = instructions.some(
      (ix: any) => ix?.name?.toLowerCase?.() === "migrate"
    );

    return migrateFound;
  }

  private newPoolTxn(parsedTxn: any): boolean {
    if (!parsedTxn?.transaction?.message) return false;

    const message = parsedTxn.transaction.message;

    const instructions = message.instructions || message.compiledInstructions;

    if (!Array.isArray(instructions)) return false;

    const createFound = instructions.some(
      (ix: any) => ix?.name?.toLowerCase?.() === "create_pool"
    );

    return createFound;
  }

  private getNewTokenMint(tx: any): string | null {
    try {
      const postBalances = tx?.meta?.postTokenBalances;

      if (!Array.isArray(postBalances) || postBalances.length === 0) {
        return null;
      }

      const mintAddress = postBalances[0]?.mint;
      if (mintAddress && typeof mintAddress === "string") {
        return mintAddress;
      }

      return null;
    } catch (err) {
      console.error("Error detecting new token mint:", err);
      return null;
    }
  }

  private getNewTokenCreate(tx: any): string | null {
    try {
      if (
      !tx?.transaction?.message?.compiledInstructions &&
      !tx?.transaction?.message?.instructions
    ) {
      return null;
    }

    const postBalances = tx?.meta?.postTokenBalances;

      if (!Array.isArray(postBalances) || postBalances.length === 0) {
        return null;
      }

    const completeParsedInstruction =
      tx.transaction.message.compiledInstructions ??
      tx.transaction.message.instructions;

    const completeInnerInstructions = tx.meta?.innerInstructions ?? [];

    const parsedInstruction: { programId: string, accounts: string[], data: any }[] = completeParsedInstruction.filter(
      (ix: { programId: string, accounts: string[], data: any }) => ix.programId === this.pumpAmmAddress
    );

    const innerInstructions: { outerIndex: number, programId: string, accounts: string[], data: any }[] = completeInnerInstructions.filter(
      (ix: { outerIndex: number, programId: string, accounts: string[], data: any }) => ix.programId === this.pumpAmmAddress
    );

    const swapInstruction = parsedInstruction?.filter((ix) => ix.programId === this.pumpAmmAddress).find(
      (ix) => ix?.data?.name === "create"
    ) || innerInstructions?.find((ix) => ix?.data?.name === "create");

    if (!swapInstruction) return null;  
    

      const mintAddress = postBalances[0]?.mint;
      if (mintAddress && typeof mintAddress === "string") {
        return mintAddress;
      }

      return null;
    } catch (error) {
      console.error("Error detecting new token create:", error);
      return null;
    }
  }

  private parseSwapTransactionOutput(tx: any) {
    if (
      !tx?.transaction?.message?.compiledInstructions &&
      !tx?.transaction?.message?.instructions
    ) {
      return;
    }

    const completeParsedInstruction =
      tx.transaction.message.compiledInstructions ??
      tx.transaction.message.instructions;

    const completeInnerInstructions = tx.meta?.innerInstructions ?? [];

    const parsedInstruction: { programId: string, accounts: string[], data: any }[] = completeParsedInstruction.filter(
      (ix: { programId: string, accounts: string[], data: any }) => ix.programId === this.pumpAmmAddress
    );

    const innerInstructions: { outerIndex: number, programId: string, accounts: string[], data: any }[] = completeInnerInstructions.filter(
      (ix: { outerIndex: number, programId: string, accounts: string[], data: any }) => ix.programId === this.pumpAmmAddress
    );

    const swapInstruction = parsedInstruction?.filter((ix) => ix.programId === this.pumpAmmAddress).find(
      (ix) => ix?.data?.name === "buy" || ix?.data?.name === "sell"
    ) || innerInstructions?.find((ix) => ix?.data?.name === "buy" || ix?.data?.name === "sell");

    if (!swapInstruction) return;

    const name = swapInstruction?.data?.name;
    const accounts = swapInstruction?.accounts;
    const args = swapInstruction?.data?.data;

    return {
      type: name,
      accounts,
      args
    }
  }
}
