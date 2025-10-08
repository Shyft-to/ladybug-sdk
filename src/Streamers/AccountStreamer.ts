import {
  CommitmentLevel,
  SubscribeRequest,
} from "@triton-one/yellowstone-grpc";
import Client from "@triton-one/yellowstone-grpc";
import { Parser } from "../Parsers/Parser";
import { PublicKey } from "@solana/web3.js";
import { Idl as CoralIdl } from "@coral-xyz/anchor";
import { Idl as SerumIdl } from "@project-serum/anchor";

export class AccountStreamer {
  private client: Client;
  private request: SubscribeRequest;
  private addresses: Set<string> = new Set();
  private owners: Set<string> = new Set();
  private running: boolean = false;
  private stream?: any;

  private onDataCallback?: (data: any) => void;
  private onErrorCallback?: (err: any) => void;
  private onEndCallback?: () => void;
  private onCloseCallback?: () => void;

  private parsers = new Parser();

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

  onError(callback: (err: any) => void) {
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
      accounts: {
        program_name: {
          account: Array.from(this.addresses),
          filters: [],
          owner: Array.from(this.owners),
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

  async addOwners(newOwners: string[]) {
    newOwners.forEach((addr) => this.owners.add(addr));
    await this.pushUpdate();
  }

  async removeOwners(removeList: string[]) {
    removeList.forEach((addr) => this.owners.delete(addr));
    await this.pushUpdate();
  }

  async addParser(programId: PublicKey, idl: CoralIdl | SerumIdl) {
    this.parsers.addParser(programId, idl);
  }


  async start() {
    this.running = true;
    while (this.running) {
      try {
        await this.handleStream();
      } catch (error) {
        console.error("Stream error, retrying in 1s...", error);
        if (this.onErrorCallback) this.onErrorCallback(error);
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
    console.log("Subscribing and starting account stream...");
    this.stream = await this.client.subscribe();

    const streamClosed = new Promise<void>((resolve, reject) => {
      this.stream!.on("error", (err: any) => {
        if (this.onErrorCallback) this.onErrorCallback(err);
        reject(err);
        this.stream!.cancel();
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
          if (data.account) {
            const formattedData = this.parsers.formatGeyserAccountData(data.account);
            const parsedData = this.parsers.parseAccount(formattedData);
            this.onDataCallback(parsedData);
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
