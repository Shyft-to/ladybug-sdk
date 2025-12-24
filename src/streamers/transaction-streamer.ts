import {
  CommitmentLevel,
  SubscribeRequest,
} from "@triton-one/yellowstone-grpc";
import Client from "@triton-one/yellowstone-grpc";
import { Parser } from "../parsers/parser";

export type gRPCConfig = {
  keepalive_time_ms?: number;
  keepalive_timeout_ms?: number;
  max_send_message_length?: number;
  max_receive_message_length?: number;
};

export class TransactionStreamer {
  private client: Client;
  private request: SubscribeRequest;
  private addresses: Set<string> = new Set();
  private running: boolean = false;
  private stream?: any;
  private parser: Parser | undefined = undefined;
  private idlInstructionNames: Set<string> = new Set();
  private onInstructionCallbacks: Record<string, (tx: any) => void> = {};
  private autoReconnect: boolean = true;
  private enableLogs: boolean = true;

  private fromSlot?: number;
  private lastReceivedSlot?: number;
  private useLastSlotOnReconnect: boolean = false;


  private onDataCallback?: (data: any) => void;
  private onErrorCallback?: (err: any) => void;
  private onEndCallback?: () => void;
  private onCloseCallback?: () => void;

  /**
   * Initializes the TransactionStreamer, which can be used to stream transactions and parse them using the provided parser
   * @param endpoint Accepts your Yellowstone gRPC Connection URL
   * @param xToken Accepts your X-token, which is used for authentication
   * @param grpcConfig Accepts additional 
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
      commitment: CommitmentLevel.PROCESSED,
    };
  }

  /**
  * Registers a callback to be triggered when a specific instruction is detected in a transaction.
  * @param instructionName The instruction name (must exist in IDL)
  * @param callback The function to invoke when that instruction appears in a transaction
  */
  onDetectInstruction(instructionName: string, callback: (tx: any) => void) {
    if (!this.idlInstructionNames.has(instructionName)) {
      if(this.enableLogs)
        console.warn(`Instruction ${instructionName} not found in IDL`);
      return;
    }
    this.onInstructionCallbacks[instructionName] = callback;
  }


  /**
   * Sets a callback function to be called when a transaction is received.
   * The callback function takes a single parameter, which is the transaction data.
   * @param callback The callback function to call when a transaction is received.
   */
  onData(callback: (data: any) => void) {
    this.onDataCallback = callback;
  }

  /**
   * Sets a callback function to be called when an error occurs while streaming transactions.
   * The callback function takes one argument, which is the error that occurred.
   * @param callback The callback function to call when an error occurs
   */
  onError(callback: (error: any) => void) {
    this.onErrorCallback = callback;
  }

  /**
   * Fired when the stream has ended.
   * @param callback Accepts a callback function, which takes no arguments
   */
  onEnd(callback: () => void) {
    this.onEndCallback = callback;
  }

  /**
   * Sets a callback function to be called when the stream has been closed.
   * This is called after the stream has been ended and the stream is no longer available.
   * @param callback The callback function to call when the stream has been closed.
   */
  onClose(callback: () => void) {
    this.onCloseCallback = callback;
  }

  /**
   * Enables or disables auto reconnect for the transaction streamer.
   * When enabled, the streamer will automatically reconnect to the stream if an error occurs.
   * @param enabled Whether to enable or disable auto reconnect.
   */
  enableAutoReconnect(enabled: boolean) {
    this.autoReconnect = enabled;
  }

  /**
   * Sets the slot to use when starting the transaction streamer.
   * This will cause the streamer to start streaming from the specified slot instead of the latest slot.
   * If set to undefined, the streamer will use the latest slot.
   * @param slot The slot to use when starting the transaction streamer. If undefined, the latest slot is used.
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
          : undefined;                      // default: latest slot

    this.request = {
      ...this.request,
      fromSlot: slotToUse ? slotToUse.toString() : undefined,
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

  /**
   * Adds a list of addresses to the transaction stream request.
   * Transactions from these addresses will be included in the transaction stream.
   * @param newAddresses The list of addresses to add to the transaction stream request.
  */
  async addAddresses(newAddresses: string[]) {
    newAddresses.forEach((addr) => this.addresses.add(addr));
    await this.pushUpdate();
  }

  /**
   * Removes a list of addresses from the transaction stream request.
   * Transactions from these addresses will no longer be included in the transaction stream.
   * @param removeList The list of addresses to remove from the transaction stream request.
   */
  async removeAddresses(removeList: string[]) {
    removeList.forEach((addr) => this.addresses.delete(addr));
    await this.pushUpdate();
  }

  /**
   * Adds a parser, which is created using the Parser class, to the transaction streamer. The parser is used to parse the transactions and accounts data received from the stream.
   * @param parser The parser to add to the transaction streamer.
   */
  async addParser(parser: Parser) {
    this.parser = parser;
    this.idlInstructionNames = parser.getAllInstructions();
  }

  /**
   * Starts the transaction stream, which will keep running until stop is called.
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
        if (!this.running) break;
        await new Promise((res) => setTimeout(res, 1000));
      }
    }
  }

  /**
   * Stops the transaction stream if it is currently running.
   * This will prevent any further transactions from being received until
   * `start` is called again.
   */
  stop() {
    this.running = false;
    this.stream?.cancel();
    this.stream = undefined;
  }

  private async handleStream() {
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
      try {
        if (data?.transaction?.slot !== undefined) {
          this.lastReceivedSlot = data.transaction.slot;
        }
        if(data?.transaction) {
          const tx = this.parser
            ? this.parser.parseTransaction(
              this.parser.formatGrpcTransactionData(data.transaction, Date.now())
            )
            : data;

          this.detectInstructionType(tx);
          if (this.onDataCallback) this.onDataCallback(tx);
        }
      } catch (err) {
        if (this.onErrorCallback) this.onErrorCallback(err);
      }
    });

    await this.pushUpdate();
    await streamClosed;

    this.stream = undefined;
  }

  /**
   * Detects which IDL instruction(s) are present in the transaction and calls the corresponding callbacks.
   * @param tx The transaction data.
   */
  private detectInstructionType(tx: any) {
    try {
      const message = tx?.transaction?.message;
      if (!message) return;

      let instructions = message.instructions || message.compiledInstructions || [];
      const innerInstructions = Array.isArray(tx.meta?.innerInstructions)
        ? tx.meta.innerInstructions.flatMap((ix: any) => ix.instructions || [])
        : [];

      const allInstructions = [...instructions, ...innerInstructions];

      for (const ix of allInstructions) {
        const name = ix?.data?.name;
        if (name && this.onInstructionCallbacks[name]) {
          this.onInstructionCallbacks[name](tx);
          break; // optional: stop after first match
        }
      }
    } catch (err) {
      if (this.onErrorCallback) this.onErrorCallback(err);
    }
  }

  /**
   * Enables or disables logging for the transaction streamer. Enabled by default.
   * When enabled, the streamer will log errors to the console.
   * @param {boolean} enable - Whether to enable or disable logging.
   */
  enableLogging(enable: boolean) {
    this.enableLogs = enable;
  }
}
