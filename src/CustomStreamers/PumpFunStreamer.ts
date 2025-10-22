import {
  CommitmentLevel,
  SubscribeRequest,
} from "@triton-one/yellowstone-grpc";
import Client from "@triton-one/yellowstone-grpc";
import { Parser } from "../Parsers/Parser";
import pumpIdl from "../IdlFiles/pump_0.1.0.json";
import { PublicKey } from "@solana/web3.js";
import { Idl } from "@coral-xyz/anchor"

export class PumpFunStreamer {
  private client: Client;
  private request: SubscribeRequest;
  private addresses: [string] = ["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"];
  private running: boolean = false;
  private stream?: any;
  private parser: Parser;

  private onDataCallback?: (data: any) => void;
  private onErrorCallback?: (err: any) => void;
  private onEndCallback?: () => void;
  private onCloseCallback?: () => void;
  private onMigrateCallback?: (tx: any) => void;
  private onNewTokenMintCallback?: (mintAddress: string, tx: any) => void;
  private onBuySellCallback?: (tx: any) => void;

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


  onData(callback: (data: any) => void) {
    this.onDataCallback = callback;
  }

  onError(callback: (error: any) => void) {
    this.onErrorCallback = callback;
  }

  onEnd(callback: () => void) {
    this.onEndCallback = callback;
  }

  onClose(callback: () => void) {
    this.onCloseCallback = callback;
  }

  onMigrate(callback: (tx: any) => void) {
    this.onMigrateCallback = callback;
  }

  onNewTokenMint(callback: (mintAddress: string, tx: any) => void) {
    this.onNewTokenMintCallback = callback;
  }

  onBuySell(callback: (tx: any) => void) {
    this.onBuySellCallback = callback;
  }


  private updateRequest() {
    this.request = {
      ...this.request,
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
  }

  private async pushUpdate() {
    if (!this.stream) return;
    this.updateRequest();
    await new Promise<void>((resolve, reject) => {
      this.stream!.write(this.request, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  //   async addAddresses(newAddresses: string[]) {
  //     newAddresses.forEach((addr) => this.addresses.add(addr));
  //     await this.pushUpdate();
  //   }


  async start() {
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

  stop() {
    this.running = false;
    this.stream?.cancel();
    this.stream = undefined;
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

      if (!this.onDataCallback && !this.onMigrateCallback) return;
      try {
        if (data.transaction) {
          const formatted = this.parser.formatGrpcTransactionData(
            data.transaction,
            Date.now()
          );
          const parsed = this.parser.parseTransaction(formatted);

          if (this.onDataCallback) 
            this.onDataCallback(parsed);

          if (this.onMigrateCallback && this.isPumpFunMigrationTransaction(parsed)) {
            this.onMigrateCallback(parsed);
          }

          const mint = this.getNewTokenMint(parsed);
          if (mint && this.onNewTokenMintCallback) {
            this.onNewTokenMintCallback(mint, parsed);
          }

          if (this.onBuySellCallback && this.parseSwapTransactionOutput(parsed)) {
            this.onBuySellCallback(parsed);
          }
        } else {
          if (this.onDataCallback) 
            this.onDataCallback(data);
        }
      } catch (err) {
        if (this.onErrorCallback) 
          this.onErrorCallback(err);
      }
    });


    await this.pushUpdate();
    await streamClosed;

    this.stream = undefined;
  }

  private isPumpFunMigrationTransaction(parsedTxn: any): boolean {
    if (!parsedTxn?.transaction?.message) 
      return false;

    const message = parsedTxn.transaction.message;

    const instructions = message.instructions || message.compiledInstructions;

    if (!Array.isArray(instructions)) 
      return false;

    const migrateFound = instructions.some(
      (ix: any) => ix?.name?.toLowerCase?.() === "migrate"
    );

    return migrateFound;
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

  private parseSwapTransactionOutput(tx: any) {
    if (!tx?.transaction?.message?.compiledInstructions && !tx?.transaction?.message?.instructions) {
      return;
    }

    const parsedInstruction =
      tx.transaction.message.compiledInstructions ??
      tx.transaction.message.instructions;

    const innerInstructions = tx.meta?.innerInstructions ?? [];

    const swapInstruction =
      parsedInstruction?.pumpAmmIxs?.find(
        (ix: any) => ix.name === "buy" || ix.name === "sell"
      ) ||
      parsedInstruction?.find(
        (ix: any) => ix.name === "buy" || ix.name === "sell"
      ) ||
      innerInstructions
        ?.flatMap((ixGroup: any) => ixGroup.instructions ?? [])
        ?.find((ix: any) => ix.name === "buy" || ix.name === "sell");

    if (!swapInstruction) return;

    const { name: type, accounts = [], args = {} } = swapInstruction;
    const baseAmountIn = args?.amount;

    const bondingCurve = accounts.find((a: any) => a.name === "bondingCurve")?.pubkey;
    const userPubkey = accounts.find((a: any) => a.name === "user")?.pubkey;
    const mint = accounts.find((a: any) => a.name === "mint")?.pubkey;

    const alternativeAmountOut = innerInstructions
      ?.flatMap((ixGroup: any) => ixGroup.instructions ?? [])
      ?.find(
        (ix: any) =>
          ix.name === "transfer" &&
          ix.args?.amount !== baseAmountIn &&
          ix.accounts?.some((acct: any) => acct.pubkey === bondingCurve)
      )?.args?.lamports;

    const tradeEvent = tx.transaction.message?.events?.find(
      (e: any) => e.name === "TradeEvent"
    );
    const solEventAmount = tradeEvent?.data?.sol_amount;
    const tokenEventAmount = tradeEvent?.data?.token_amount;

    const isBuy = type === "buy";
    const inAmount = isBuy ? solEventAmount : tokenEventAmount;
    const outAmount = isBuy
      ? tokenEventAmount
      : solEventAmount ?? alternativeAmountOut;

    return {
      type,
      user: userPubkey,
      mint,
      bonding_curve: bondingCurve,
      in_amount: inAmount,
      out_amount: outAmount,
    };
  }


}
