import {
    CommitmentLevel,
    SubscribeRequest,
} from "@triton-one/yellowstone-grpc";
import Client from "@triton-one/yellowstone-grpc";
import { utils } from "@coral-xyz/anchor";
import { Parser } from "../parsers/parser";

type TxnData = {
    signature: string;
    createdAt: number;
    blockTime: number;
    receivedTime: number;
};
type GroupedTxnData = {
    [slot: string]: TxnData[];
};

interface TransactionUpdate {
    type: "transaction" | "slot";
    transactionSignature: string;
    createdAtReceived: number;
    blocktimeReceived: number;
    slot: number;
    gRPCBlocktime: number;
}


export class LatencyChecker {
    private client: Client;
    private request: SubscribeRequest;
    private addresses: Set<string> = new Set();
    private running: boolean = false;
    private stream?: any;
    private parser: Parser | undefined = undefined;
    private idlInstructionNames: Set<string> = new Set();
    private onInstructionCallbacks: Record<string, (tx: any) => void> = {};

    private groupedTxnData: GroupedTxnData = {};
    private accumLatency = 0;
    private count = 0;

    private onDataCallback?: (data: any) => void;
    private onErrorCallback?: (err: any) => void;
    private onEndCallback?: () => void;
    private onCloseCallback?: () => void;

    /**
     * Initializes the TransactionStreamer, which can be used to stream transactions and parse them using the provided parser
     * @param endpoint Accepts your Yellowstone gRPC Connection URL
     * @param xToken Accepts your X-token, which is used for authentication
     */
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

    /**
    * Registers a callback to be triggered when a specific instruction is detected in a transaction.
    * @param instructionName The instruction name (must exist in IDL)
    * @param callback The function to invoke when that instruction appears in a transaction
    */
    onDetectInstruction(instructionName: string, callback: (tx: any) => void) {
        if (!this.idlInstructionNames.has(instructionName)) {
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

    private updateRequest() {
        this.request = {
            ...this.request,
            transactionsStatus: {
                transactions: {
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

                if (data?.blockMeta) {
                    const slotReceived = data?.blockMeta?.slot;
                    const blocktimeReceived = data?.blockMeta?.blockTime?.timestamp
                        ? Number(data?.blockMeta?.blockTime?.timestamp) * 1000
                        : 0;
                    this.sortUpdateType({
                        type: "slot",
                        slot: slotReceived,
                        gRPCBlocktime: blocktimeReceived,
                        createdAtReceived: 0,
                        blocktimeReceived: 0,
                        transactionSignature: "",
                    });
                    return;
                }

                if(data.transaction) {
                    const receivedTime = Date.now();
                    const transactionSignature = data?.transaction?.signature
                        ? utils.bytes.bs58.encode(data?.transaction?.signature)
                        : "";
                    const receivedSlot = data?.transaction?.slot;
                    console.log("Received Slot 123: ", receivedSlot);
                    this.sortUpdateType({
                        type: "transaction",
                        transactionSignature,
                        createdAtReceived: 0,
                        blocktimeReceived: receivedTime,
                        slot: receivedSlot,
                        gRPCBlocktime: 0,
                    });
                    return;
                }

                // if (data?.transactionStatus) {
                //     const receivedTime = Date.now();
                //     const transactionSignature = data?.transactionStatus?.signature
                //         ? utils.bytes.bs58.encode(data?.transactionStatus?.signature)
                //         : "";

                //     const receivedSlot = data?.transactionStatus?.slot;

                //     let createdAt = 0;
                //     if (data?.transactionStatus?.createdAt) {
                //         createdAt = new Date(data?.transactionStatus?.createdAt).getTime();
                //     }

                //     try {
                //         this.sortUpdateType({
                //             type: "transaction",
                //             transactionSignature,
                //             createdAtReceived: createdAt,
                //             blocktimeReceived: receivedTime,
                //             slot: receivedSlot,
                //             gRPCBlocktime: 0,
                //         });
                //         return;
                //     } catch (error) {
                //         console.error("parsing error: ", error, transactionSignature);
                //     }
                // }

                // const tx = this.parser
                //   ? this.parser.parseTransaction(
                //       this.parser.formatGrpcTransactionData(data.transaction, Date.now())
                //     )
                //   : data;

                // this.detectInstructionType(tx);

                // if (this.onDataCallback) this.onDataCallback(tx);
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

    addDatafromTransaction(
        slot: string,
        signature: string,
        createdAt: number,
        blockTime: number,
        receivedTime: number
    ) {
        if (!this.groupedTxnData[slot]) {
            this.groupedTxnData[slot] = [];
        }
        this.groupedTxnData[slot].push({
            signature,
            createdAt,
            blockTime,
            receivedTime,
        });
    }

    addDatafromBlockMeta(slot: string, blockTime: number) {
        if (!this.groupedTxnData[slot]) return;

        for (let i = 0; i < this.groupedTxnData[slot].length; i++) {
            //add check to remove older blocks

            this.groupedTxnData[slot][i].blockTime = blockTime;
            console.log("Signature: ", this.groupedTxnData[slot][i].signature);
            console.log(
                "BlockTime: ",
                blockTime,
                "ReceivedTime: ",
                this.groupedTxnData[slot][i].receivedTime,
                "created At: ",
                this.groupedTxnData[slot][i].createdAt
            );
            console.log(
                "Observed Latency: ",
                this.groupedTxnData[slot][i].receivedTime - blockTime
            );
            console.log(
                "Latency based on created at: ",
                this.groupedTxnData[slot][i].receivedTime -
                this.groupedTxnData[slot][i].createdAt
            );

            this.accumLatency +=
                this.groupedTxnData[slot][i].receivedTime - blockTime;
            this.count++;

            console.log("\nAverage Latency: ", this.accumLatency / this.count);

            //   reportGen.collectData(
            //     blockTime,
            //     this.groupedTxnData[slot][i].receivedTime
            //   );
        }

        // Remove slots older than 20
        const slotsToRemove: string[] = [];
        for (const storedSlot in this.groupedTxnData) {
            if (Number(storedSlot) < Number(slot) - 20) {
                slotsToRemove.push(storedSlot);
            }
        }

        slotsToRemove.forEach((slotToRemove) => {
            delete this.groupedTxnData[slotToRemove];
        });
    }

    private sortUpdateType(txn_item: TransactionUpdate) {
        // console.log("executing worker");
        const {
            type,
            transactionSignature,
            createdAtReceived,
            blocktimeReceived,
            slot,
            gRPCBlocktime,
        } = txn_item;

        if (type === "slot") {
            this.addDatafromBlockMeta(slot.toString(), gRPCBlocktime);
        } else if (type === "transaction") {
            this.addDatafromTransaction(
                slot.toString(),
                transactionSignature,
                createdAtReceived,
                0,
                blocktimeReceived
            );
        } else {
            console.log("Unknown type: ", type);
            return;
        }
    };
}
