import {
  CommitmentLevel,
  SubscribeRequest,
} from "@triton-one/yellowstone-grpc";
import Client from "@triton-one/yellowstone-grpc";
import { Parser } from "../parsers/parser";
import { gRPCConfig } from "./transaction-streamer";


export class AccountStreamer {
  private client: Client;
  private request: SubscribeRequest;
  private addresses: Set<string> = new Set();
  private owners: Set<string> = new Set();
  private running: boolean = false;
  private stream?: any;
  private enableLogs: boolean = true;
  private commitmentLevel: CommitmentLevel = CommitmentLevel.PROCESSED;

  private onDataCallback?: (data: any) => void;
  private onErrorCallback?: (err: any) => void;
  private onEndCallback?: () => void;
  private onCloseCallback?: () => void;

  private parser: Parser | undefined = undefined;

  private autoReconnect: boolean = true;
  private fromSlot?: number;
  private lastReceivedSlot?: number;
  private useLastSlotOnReconnect: boolean = false;

/**
 * Initializes the AccountStreamer, which can be used to stream account data and parse it using the provided parser
 * @param endpoint Accepts your Yellowstone gRPC Connection URL
 * @param xToken Accepts your X-token, which is used for authentication
 */
  constructor(endpoint: string, xToken?: string, grpcConfig?: gRPCConfig) {
    let grpcConfigtoSet = {};
        if (grpcConfig) {
          if (grpcConfig.keepalive_time_ms) {
            grpcConfigtoSet = { ...grpcConfigtoSet, 'grpc.keepalive_time_ms': grpcConfig.keepalive_time_ms };
          }
          if (grpcConfig.keepalive_timeout_ms) {
            grpcConfigtoSet = { ...grpcConfigtoSet, 'grpc.keepalive_timeout_ms': grpcConfig.keepalive_timeout_ms };
          }
          if (grpcConfig.max_send_message_length) {
            grpcConfigtoSet = { ...grpcConfigtoSet, 'grpc.max_send_message_length': grpcConfig.max_send_message_length };
          }
          if (grpcConfig.max_receive_message_length) {
            grpcConfigtoSet = { ...grpcConfigtoSet, 'grpc.max_receive_message_length': grpcConfig.max_receive_message_length };
          }
        }
        this.client = new Client(endpoint, xToken, grpcConfig ? grpcConfigtoSet : undefined);

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
      commitment: this.commitmentLevel,
    };
  }

  
  /**
   * Sets a callback function to be called when account data is received.
   * The callback function takes a single parameter, which is the account data.
   * @param callback The callback function to call when account data is received.
   */
  onData(callback: (data: any) => void) {
    this.onDataCallback = callback;
  }

  /**
   * Sets a callback function to be called when an error occurs while streaming account data.
   * The callback function takes a single parameter, which is the error that occurred.
   * @param callback The callback function to call when an error occurs
   */
  onError(callback: (err: any) => void) {
    this.onErrorCallback = callback;
  }

/**
 * Fired when the stream has ended. This is called after the stream has been ended and the stream is no longer available.
 * @param callback Accepts a callback function, which takes no arguments
 */
  onEnd(callback: () => void) {
    this.onEndCallback = callback;
  }

  /**
   * Sets a callback function to be called when the stream has been closed.
   * This is called after the stream has been ended and the stream is no longer available.
   * @param callback Accepts a callback function, which takes no arguments
   */
  onClose(callback: () => void) {
    this.onCloseCallback = callback;
  }

  /**
   * Enables or disables auto reconnect for the account streamer.
   * When enabled, the streamer will automatically reconnect to the stream if an error occurs.
   * @param enabled Whether to enable or disable auto reconnect.
   */
  enableAutoReconnect(enabled: boolean) {
    this.autoReconnect = enabled;
  }

  
  /**
   * Sets the slot to start the stream from. This can be used to resume the stream from a specific slot.
   * If not set, the stream will start from the latest available slot.
   * @param slot The slot to start the stream from.
   */
  setFromSlot(slot: number) {
    this.fromSlot = slot;
  }

  resumeFromLastSlot(enabled: boolean) {
    this.useLastSlotOnReconnect = enabled;
  }

  private updateRequest() {
    const slotToUse =
      this.fromSlot !== undefined
        ? this.fromSlot                     // user-forced slot
        : this.useLastSlotOnReconnect
          ? this.lastReceivedSlot           // automatic resume
          : undefined;   
    
    this.request = {
      ...this.request,
      commitment: this.commitmentLevel,
      fromSlot: slotToUse ? slotToUse.toString() : undefined,
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

  /**
   * Adds a list of addresses to the account stream request.
   * Accounts from these addresses will be included in the account stream.
   * @param newAddresses The list of addresses to add to the account stream request.
   */
  async addAddresses(newAddresses: string[]) {
    newAddresses.forEach((addr) => this.addresses.add(addr));
    await this.pushUpdate();
  }

  /**
   * Removes a list of addresses from the account stream request.
   * Accounts from these addresses will no longer be included in the account stream.
   * @param removeList The list of addresses to remove from the account stream request.
   */
  async removeAddresses(removeList: string[]) {
    removeList.forEach((addr) => this.addresses.delete(addr));
    await this.pushUpdate();
  }

  /**
   * Adds a list of addresses to the account stream request as owners.
   * Accounts for which these addresses are owners will be included in the account stream.
   * @param newOwners The list of addresses to add to the account stream request as owners.
   */
  async addOwners(newOwners: string[]) {
    newOwners.forEach((addr) => this.owners.add(addr));
    await this.pushUpdate();
  }

  /**
   * Removes a list of addresses from the account stream request as owners.
   * Accounts for which these addresses are no longer owners will no longer be included in the account stream.
   * @param removeList The list of addresses to remove from the account stream request as owners.
   */
  async removeOwners(removeList: string[]) {
    removeList.forEach((addr) => this.owners.delete(addr));
    await this.pushUpdate();
  }

  async setCommitmentLevel(commitment: "PROCESSED"| "CONFIRMED" | "FINALIZED") {
    if(commitment === "PROCESSED") 
      this.commitmentLevel = CommitmentLevel.PROCESSED;
    if(commitment === "CONFIRMED") 
      this.commitmentLevel = CommitmentLevel.CONFIRMED;
    if(commitment === "FINALIZED") 
      this.commitmentLevel = CommitmentLevel.FINALIZED;
    await this.pushUpdate();
  }

  async addParser(parser: Parser) {
    this.parser = parser;
  }


  /**
   * Starts the account stream, which will keep running until stop is called.
   * The stream will retry indefinitely if an error occurs, with a maximum delay of 30s.
   * The delay between retries will double each time an error occurs, up to a maximum of 30s.
   */
  async start() {
    this.running = true;
    while (this.running) {
      try {
        await this.handleStream();
      } catch (error) {
        if (!this.autoReconnect) {
          if(this.enableLogs)
            console.error("Stream error. Auto-reconnect disabled. Stopping...", error);
          break;
        }
        if(this.enableLogs)
          console.error("Stream error, retrying in 1s...", error);
        if (this.onErrorCallback) this.onErrorCallback(error);
        if (!this.running) break;
        await new Promise((res) => setTimeout(res, 1000));
      }
    }
  }

  /**
   * Stops the account stream if it is currently running.
   * This will prevent any further accounts from being received until
   * `start` is called again.
   */
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
        const msg = String(err?.message || err);

        const slotUnavailable =
          msg.includes("not available") ||
          msg.includes("unavailable") ||
          msg.includes("older than") ||
          msg.includes("newer than") ||
          msg.includes("out of range") ||
          msg.includes("last available");

        if (slotUnavailable) {
          if(this.enableLogs)
            console.warn("⚠️ Slot unavailable:", msg);

          this.fromSlot = undefined;
          this.useLastSlotOnReconnect = false;

          this.stream?.cancel();
          reject(err);
          return;
        }

        if (this.onErrorCallback) this.onErrorCallback(err);
        this.stream?.cancel();
        reject(err);
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
            if (data?.account?.slot !== undefined) {
              this.lastReceivedSlot = data.account.slot;
            }
            if(this.parser === undefined) {
              this.onDataCallback(data);
              return;
            }
            const formattedData = this.parser.formatGeyserAccountData(data.account);
            const parsedData = this.parser.parseAccount(formattedData);
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

  /**
   * Enables or disables logging for the account streamer. Enabled by default.
   * When enabled, the streamer will log errors to the console.
   * @param {boolean} enable - Whether to enable or disable logging.
   */
  enableLogging(enable: boolean) {
    this.enableLogs = enable;
  }
}
