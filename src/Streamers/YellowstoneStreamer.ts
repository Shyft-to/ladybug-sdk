import {
  CommitmentLevel,
  SubscribeRequest,
} from "@triton-one/yellowstone-grpc";
import Client from "@triton-one/yellowstone-grpc";

export type StreamCallbacks = {
  onData?: (data: any) => void;
  onError?: (err: Error) => void;
  onClose?: () => void;
};

export class YellowstoneStreamer {
  private client: Client;
  private request: SubscribeRequest;
  private callbacks: StreamCallbacks;
  private running: boolean = false;

  constructor(
    endpoint: string,
    xToken: string | undefined,
    request: SubscribeRequest,
    callbacks: StreamCallbacks = {}
  ) {
    this.client = new Client(endpoint, xToken, undefined);
    this.request = request;
    this.callbacks = callbacks;
  }

  async start() {
    this.running = true;
    while (this.running) {
      try {
        await this.handleStream();
      } catch (error) {
        this.callbacks.onError?.(error as Error);
        if (!this.running) break;
        console.error("Stream error, retrying in 1s...");
        await new Promise((res) => setTimeout(res, 1000));
      }
    }
  }

  stop() {
    this.running = false;
  }

  private async handleStream() {
    console.log("Subscribing and starting stream...");
    const stream = await this.client.subscribe();

    const streamClosed = new Promise<void>((resolve, reject) => {
      stream.on("error", (err) => {
        reject(err);
        stream.end();
      });
      stream.on("end", resolve);
      stream.on("close", resolve);
    });

    // single onData handler
    stream.on("data", (data) => {
      this.callbacks.onData?.(data);
    });

    // Send subscription request
    await new Promise<void>((resolve, reject) => {
      stream.write(this.request, (err: any) => {
        if (!err) resolve();
        else reject(err);
      });
    });

    await streamClosed;
    this.callbacks.onClose?.();
  }
}
