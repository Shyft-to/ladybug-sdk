# 🐞 ladybug-sdk: The ultimate toolkit for Yellowstone gRPC streaming and parsing
Build your trading strategies faster and easily with the ultimate Solana sdk for Yellowstone gRPC streaming and parsing. Stop recreating the parsing wheel and focus on improving your trading strategies.

## ✨ Features
- **Yellowstone gRPC Abstraction:** Works with Yellowstone gRPC client under the hood while providing a clean and dev-friendly abstraction layer.

- **Parsing:** The SDK completely abstracts complex parsing logic, automatically handling parsing of transaction, anchor events and accounts data so you receive clean, human-readable objects ready for use.

- **Instruction Detection:** Easily listen for instructions or inner-instruction. The sdk will stream and parse behind the hood and only notify you when your instruiction is invoked.

- **Token and System Program Parsing:** Enable System, Token and Token22 transaction parsing with just a flag.

- **Reconnect Mechanism:** In-built reconnect mechanism on stream interruption.

- **Historical Replay:** Can be configured to stream exactly from where the stream breaks so you dont miss any data.

- **TypeScript Native:** Written in TypeScript for better developer experience and type safety.

## Parsers

The parser accepts two types of IDL, the IDL which are compatible with `@coral-xyz/anchor` and `@project-serum/anchor`.

### Initialization
```javascript
import { Parser } from "@shyft-to/ladybug-sdk";
import { Idl as coralXyzIdl } from "@coral-xyz/anchor";
import { Idl as projectSerumIdl } from "@project-serum/anchor";

const parser = new Parser(); //initialization
parser.addIDL(new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"), pumpIdl as coralXyzIdl); //adding a new parser for a specific program

```

Once this is initialized, we can decode both transactions and accounts using this parser.

```javascript
parser.parseTransaction(tx); //parsing transactions
parser.parseAccountData(rawAccount); //parsing account
```

### Enabling default parsers: Default System Program, Token Program & Token 2022 Program

The SDK contains a default parser for 
- System Program (`11111111111111111111111111111111`), 
- Token Program (`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`) 
- Token 2022 Program (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`) 

and parsed instructions for these can be enabled using the `useDefaultInstructionParsing()` function. This is disabled by default (set to  `false`).

```javascript
const parser = new Parser();
parser.addIDL(new PublicKey("CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK"), clmmIdl as Idl);
// after the initialization step

parser.useDefaultInstructionParsing(true); // enables in-built parser for Token Program, Token 2022 and System Program
```

### Complete parser example

We can fetch a transactions from any Solana RPC, and parse it in the following manner with default instruction parsing enabled.

```javascript
import { Idl } from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import { Parser } from "@shyft-to/ladybug-sdk";
import pumpIdl from "./pump_0.1.0.json";

async function getAndParseTxn() {
  const connection = new Connection("https://api.mainnet-beta.solana.com");

  const parser = new Parser();
  parser.addIDL(new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"), pumpIdl as Idl);
  parser.useDefaultInstructionParsing(true);

  const txnSignature = "VPKRYrn8q7FzJdEboDPGMXKPD5ne6Qab5wjfKqUDF6adm9BGkhz2E91E6NrsoPsvwtKtE7pzv4A8BDyaknQdk3X";

  const transaction = await connection.getTransaction(txnSignature, {
      maxSupportedTransactionVersion: 0
    });
  
  if(!transaction) throw new Error("Transaction not found");
  const parsed = parser.parseTransaction(transaction);

  console.log(JSON.stringify(parsed));
}

getAndParseTxn();
```

## Transaction Streamer
We can stream parsed transactions using the `TransactionStreamer` class. It accepts your `gRPC url` and `x-token`, and a `parser` object to parse transactions.

### Initialize Streamer and Parser

A TransactionStreamer can be initialized in the following manner. For streaming parsed transaction, we need to add the respective program's parser in the following manner: 

```javascript
const parser = new Parser();
parser.addIDL(new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"), pumpIdl as Idl);
//initialzing a 'Pumpfun parser' by adding the pump.fun IDL as show in previous step

const streamer = new TransactionStreamer("Your-gRPC-endpoint","access-token"); 
//initializing the Transaction Streamer

streamer.addParser(parser);
//adding Pumpfun parser to the Transaction Streamer
```

### Stream Transactions for addresses
Once initialized, we can add the address for which we want to stream transactions. Please note, when streaming data will be parsed for programs whose parsers are added. 
Since we have added the Pump.fun parser to the Streamer, we are adding the Pump.fun address in this example. Any other address, such as any wallet or pool address can also be added.

```javascript
import { Idl } from "@coral-xyz/anchor";
import { Parser, TransactionStreamer } from "@shyft-to/ladybug-sdk";
import pumpIdl from "./pump_0.1.0.json";

const parser = new Parser();
parser.addIDL(new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"), pumpIdl as Idl);
// Initializing parser with Pump.fun IDL

const streamer = new TransactionStreamer(process.env.ENDPOINT!, process.env.X_TOKEN);
streamer.addParser(parser);
// setting up streamer to parse using the Pump.fun parser

streamer.addAddresses(["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"]);
// adds the address to stream data from

streamer.onData(processData);
// set the callback function that receives the data

streamer.start();
//starts streaming transactions
```

`callbackFn` is the function which received the incoming transactions for further processing. Here is a sample function that just prints the transactions which are received. 

```javascript
async function processData(processed) {
  //handle the incoming transaction
  console.log("Received Data: ");
  console.log(processed);
}
```
Please note that transactions of programs for which Parsers have been added will only be parsed. 

We can stop streaming transactions in the following manner.
```javascript
streamer.stop() //stop streaming

streamer.removeAddresses(["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"]) //accepts a list of address and removes it
```

### Instruction Detection
You can now easily detect instrcutions, by specifying hooks for which instructions you want to lsiten to. The sdk abstracts away all the complexities. Its parses transactions and looks for instructions in both top level and inner instructions.

For example, the pump.fun IDL has various instructions such as: `buy`, `sell`, `migrate` etc. We can detect when a particular instruction gets triggered.


```javascript
//after streamer has been initialized with a parser

streamer.onDetectInstruction("buy", processData);
// will stream the transaction which contain the `buy` instruction. `processData` is the callback function which handle the incoming transaction.

streamer.onDetectInstruction("sell", processData);
// similarly, this will stream the transactions with `sell` instruction. Please note that this is only possible if the IDL is added to the Parser. Not allowed for Default parsers.
```

The parser needs to have an IDL added in order to stream transactions from a specific program. 
 
>Please note that this is not applicable for instructions available in the programs defined in the `default parsers` section.

## Examples


### Stream all Pump.fun transactions (parsed)
With the streamer and parser both initialized (as illustrated above), we can stream all parsed transaction of a specific program in the following manner. The example illustrates, streaming all pump.fun parsed transactions. This can be achieved using the `onData()` hook which accepts a callback function.  

```javascript
import { Idl } from "@coral-xyz/anchor";
import { Parser, TransactionStreamer } from "@shyft-to/ladybug-sdk";
import pumpIdl from "./pump_0.1.0.json";

const parser = new Parser();
parser.addIDL(new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"), pumpIdl as Idl);
const streamer = new TransactionStreamer(process.env.ENDPOINT!, process.env.X_TOKEN);
//add grpc url and x-token here
streamer.addParser(parser);
//initialized the streamer to stream Pump.fun transactions

streamer.addAddresses(["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"]);

streamer.onData(processData);

streamer.start();
//start streaming parsed transactions

async function processData(tx: any) {
  // callback function that accepts and can process the incoming parsed transaction
  console.log("\n\nProcessed:\n");
  console.log(JSON.stringify(tx)); 
}
```


### Detect token migration on Pump.fun: Streaming transactions of a specific event (`migrate`)

You can use this instruction filtering mechanism to establish a high-speed stream of a specific type of transactions, for example a `buy`, `sell` or transaction. 

This feature is great for finding important events fast, such as when **someone buys or sells a token** on platforms like Pump.fun, or when a **token migration takes place**. This makes sure you get the full, easy-to-read details of the transaction as soon as the buy, sell, or migration happens on the chain.

```javascript
import { Idl } from "@coral-xyz/anchor";
import { Parser, TransactionStreamer } from "@shyft-to/ladybug-sdk";
import pumpIdl from "./pump_0.1.0.json";

const parser = new Parser();
parser.addIDL(new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"), pumpIdl as Idl);

const streamer = new TransactionStreamer(process.env.ENDPOINT!, process.env.X_TOKEN);
streamer.addParser(parser);
//setting up the streamer to stream and parse pumpfun transactions

streamer.addAddresses(["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"]); //for streaming pumpfun transactions

streamer.onDetectInstruction("migrate", processData);
//detects the migrate instruction and sends the transaction to the callback function

streamer.start();

async function processData(tx: any) {
  console.log("\n\nProcessed:\n");
  console.log(JSON.stringify(tx)); 
}
```

### Detect new Liquidity pool on Raydium CLMM: Streaming `create_pool` on Raydium CLMM

Suppose we have a TransactionStreamer which is set to stream and parse `Raydium CLMM` transactions. Now, we can detect new pools by adding a `onDetectInstruction()` hook, with the `create_pool` instruction in the following manner.

```javascript
import { Idl } from "@coral-xyz/anchor";
import { Parser, TransactionStreamer } from "@shyft-to/ladybug-sdk";
import ammv3 from "./clmm_0.0.1.json";

const parser = new Parser();
parser.addIDL(new PublicKey("CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK"), ammv3 as Idl);

const streamer = new TransactionStreamer(process.env.ENDPOINT!, process.env.X_TOKEN);
streamer.addParser(parser);

streamer.addAddresses(["CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK"]);
//Initialized the clmm streamer with Raydium Clmm parser, to stream parsed transactions from the blockchain
streamer.onDetectInstruction("create_pool", processData);
//detect the create pool transaction and send to the callback function

streamer.start();

async function processData(tx: any) {
  console.log("\n\nProcessed:\n");
  console.log(JSON.stringify(tx)); 
}
```

This streams all transactions which contains the `create_pool` instruction from Raydium CLMM. 

## Account Streamer
We can stream parsed account data using the `AccounStreamer` class. Similar to transactions, it also accepts your `gRPC url` and `x-token`, and a `parser` object to stream parsed account data in real-time.

### Initialization
An `AcountStreamer` can be initialized in the following manner. Similar to transactions, for streaming decoded account data, we need to add the respective program's parser in the following manner: 

```javascript
// Initializing Parser with Raydium CLMM IDL
import { Parser, AccountStreamer } from "@shyft-to/ladybug-sdk";

const parser = new Parser();
parser.addIDL(new PublicKey("CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK"), clmmIdl as Idl);
```

```javascript
const accountStreamer = new AccountStreamer("Your gRPC URL", "Your x-token");
accountStreamer.addParser(parser);
// adding the parser initialized in the previous step.
```

Once the `AccountStreamer` is initialized, we can stream accounts based on two criterias:  

### Streaming Accounts for a Program
We can stream accounts owned by a particular address i.e. all accounts for a program. This can be accomplished using by adding the program address using the `addOwners()` function.  Data is streamed as soon as the account is updated.

```javascript
accountStreamer.addOwners(["CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK"]);
// accounts owned by this address will be streamed

accountStreamer.onData(processData);
// Similar to transaction streaming, onData accepts a callback function that handles incoming account data.

accountStreamer.start()
//starts streaming accounts.
```

### Example: Streaming all parsed Pump.fun account information

This class sets up a dedicated stream to receive and automatically parse all account updates related to the Pump.fun program, providing real-time structured data for every relevant event.

```javascript
import { Idl } from "@coral-xyz/anchor";
import { Parser, AccountStreamer } from "@shyft-to/ladybug-sdk";
import pumpIdl from "./pump_0.1.0.json";

const parser = new Parser();
parser.addIDL(new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"), pumpIdl as Idl);

const accStreamer = new AccountStreamer(process.env.ENDPOINT!, process.env.X_TOKEN);
accStreamer.addParser(parser);
//setting up the account streamer to parse Pump.fun accounts

accStreamer.addOwners(["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"]);
//Account updates for accounts owned by this program is streamed

accStreamer.onData(processData);

accStreamer.start();

async function processData(tx: any) {
  console.log("\n\nParsed Account:\n");
  console.log(JSON.stringify(tx)); 
}
```


### Streaming updates for a single account: Account updates for a Liquidity Pool

We can use the `AccountStreamer` class to monitor changes to just one specific account on the Solana blockchain. This can be particularly useful in monitoring the exact, **current state of a liquidity pool** to see real-time shifts in its available funds, or monitoring a token's **bonding curve account** very closely before migration. We can stream transactions for a liquidity pool in the following manner: 

```javascript
import { Idl } from "@coral-xyz/anchor";
import { Parser, AccountStreamer } from "@shyft-to/ladybug-sdk";
import meteoraIdl from "./meteora_0.0.1.json";

const parser = new Parser();
parser.addIDL(new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo"), meteoraIdl as Idl);
parser.useDefaultInstructionParsing(false);

const accStreamer = new AccountStreamer(process.env.ENDPOINT!, process.env.X_TOKEN);
accStreamer.addParser(parser);
//setting up the account parser to stream meteora liquidity pool transactions

accStreamer.addAddresses(["4ajsg9YY1YKd2yYSbWicAe8uZ5ZSrHQ4dcWN2xedoqsN"]);
// add the account address for which the updates will be streamed. Updates will be streamed as soon as this account changes state

accStreamer.onData(processData);
accStreamer.start();

async function processData(tx: any) {
  //receive the parsed account info
  console.log("\n\nParsed Account:\n");
  console.log(JSON.stringify(tx)); 
}
```


## Client Configuration and Advanced Streaming Options

This section details the optional configuration parameters and control mechanisms available for the `TransactionStreamer` and `AccountStreamer` classes in the _Ladybug SDK_.

### Customizing gRPC Connection Options

You can pass an optional object containing standard gRPC channel arguments to the constructor of both the `TransactionStreamer` and `AccountStreamer` classes. These options allow for fine-tuning the connection behavior.

```javascript
const txnStreamer = new TransactionStreamer(
  process.env.ENDPOINT!, //your gRPC endpoint
  process.env.X_TOKEN, //your x-token, optional
  {
    keepalive_time_ms = 2000,
    keepalive_timeout_ms = 2000,
    max_send_message_length = 1024 * 1024,
    max_receive_message_length = 1024 * 1024 * 1024
  }
);
```


Tip: `max_receive_message_length` determines the size of the message to be received, when you have a lot of addresses in your subscribe request, it is recommended to set this to a very high value.

### Enabling a Reconnect mechanism
The _Ladybug SDK_ includes a robust, built-in reconnection mechanism that attempts to re-establish the stream connection within one second of disconnection.

This feature is enabled by default but can be toggled using the `enableAutoReconnect(boolean)` method if you wish to implement custom handling for stream failures.

```javascript
const txnStreamer = new TransactionStreamer(process.env.ENDPOINT!, process.env.X_TOKEN);
txnStreamer.addParser(parser);

txnStreamer.addAddresses(["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"]);

txnStreamer.enableAutoReconnect(false);
// This is enabled by default, can be disabled in the following manner in case you want to implement your own reconnection mechanism.

```

### Streaming data from a particular Slot

When the Client disconnects, the reconnect mechanism allows re-connection after a particular timeout. But during the period of this timeout, some slots are skipped or missed. To deal with this problem, _Ladybug SDK_ allows streaming data from a particular slot.

We can define from which slot data can be streamed using the `setFromSlot()` function.

```javascript
const txnStreamer = new TransactionStreamer(process.env.ENDPOINT!, process.env.X_TOKEN);

txnStreamer.addParser(parser);
txnStreamer.addAddresses(["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"]);
txnStreamer.enableAutoReconnect(false); //setting this to false, incase the slot enquired is not available

txnStreamer.setFromSlot(383944613); //set the slot from which you want to resume streaming

txnStreamer.start();
```

Please note that if the slot enquired is not available, it will start streaming from the current slot.


## Latency Checker

The `LatencyChecker` class provides a dedicated mechanism for benchmarking the speed of data delivery from a Solana gRPC endpoint to a consuming application. It subscribes to specific programs, captures both Transaction Status and Block Meta updates, and correlates them to calculate the observed latency.

### Core Functionality
- Latency Measurement: Calculates the latency as $\text{Time}_{\text{Received}} - \text{Time}_{\text{BlockTime}}$.
- Latency Distribution: Tracks transaction counts across multiple latency buckets (e.g., `<400 ms`, `<800 ms`, etc).
- Time-Based Testing: Automatically stops streaming and generates a final report after a configurable duration (testingTime).
- Parsing Latency (Optional): Can measure the additional overhead if a complex parser is applied to the raw transaction data.


### Basic Latency Check

This example sets up the checker to monitor a single account for 30 seconds and then prints the aggregated report.

```javascript
import { LatencyChecker } from '@shyft-to/ladybug-sdk';

// Replace with your actual gRPC endpoint and token (if needed)
const ENDPOINT = "YOUR_YELLOWSTONE_GRPC_ENDPOINT"; 
const X_TOKEN = process.env.X_TOKEN;

// The public key of the account you want to monitor (e.g., a high-activity DEX program)
const ACCOUNT_TO_MONITOR = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"; 

async function runBasicCheck() {
    const latencyChecker = new LatencyChecker(ENDPOINT, X_TOKEN);

    // 1. Configure the test duration (30 seconds)
    latencyChecker.setTestingTime(30 * 1000); 

    // 2. Specify which account transactions to monitor
    await latencyChecker.addAddresses([ACCOUNT_TO_MONITOR]);
    
    console.log(`Starting latency check for ${ACCOUNT_TO_MONITOR} over 30s...`);

    // 3. Start the stream. This function will block until the testingTime is reached.
    await latencyChecker.start();

    // The report will be automatically printed to the console upon timeout/stop.
}

runBasicCheck().catch(console.error);
```




