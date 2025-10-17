import {
  CommitmentLevel,
  SubscribeRequest,
} from "@triton-one/yellowstone-grpc";
import Client from "@triton-one/yellowstone-grpc";
import { Parser } from "../Parsers/Parser";

export class TransactionStreamer {
  private client: Client;
  private request: SubscribeRequest;
  private addresses: Set<string> = new Set();
  private running: boolean = false;
  private stream?: any;
  private parser: Parser | undefined = undefined;
  
  private onDataCallback?: (data: any) => void;
  private onErrorCallback?: (err: any) => void;
  private onEndCallback?: () => void;
  private onCloseCallback?: () => void;

  constructor(endpoint: string, xToken?: string) {
    this.client = new Client(endpoint, xToken, undefined);

    this.request = {
      accounts: {},
      slots: {},
      transactions: {},
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

  async addAddresses(newAddresses: string[]) {
    newAddresses.forEach((addr) => this.addresses.add(addr));
    await this.pushUpdate();
  }

  async removeAddresses(removeList: string[]) {
    removeList.forEach((addr) => this.addresses.delete(addr));
    await this.pushUpdate();
  }

  async addParser(parser: Parser) {
    this.parser = parser;
  }

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
    console.log("Subscribing and starting stream...");
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
      if (this.onDataCallback) {
        try {
          
          if (data.transaction) {
            if(this.parser === undefined) {
              this.onDataCallback(data);
              return;
            }
            const formatted = this.parser.formatGrpcTransactionData(
              data.transaction,
              Date.now()
            );
            const parsed = this.parser.parseTransaction(formatted);
            this.onDataCallback(parsed);
          } else {
            this.onDataCallback(data);
          }
        } catch (err) {
          if (this.onErrorCallback) this.onErrorCallback(err);
        }
      }
    });

    await this.pushUpdate();
    await streamClosed;

    this.stream = undefined;
  }
}
