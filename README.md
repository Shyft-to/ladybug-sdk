# 🐞 ladybug-sdk: Real-Time Solana Data Streamer
A TypeScript SDK for streaming and parsing real-time Solana blockchain data using the Yellowstone gRPC service.

## ✨ Features
- **Real-Time Data:** Stream transactions and account updates directly from the Solana network.

- **Event Detection:** Built-in logic to easily detect common DeFi events like Buys, Sells, and Token Launches.

- **Custom Parsing:** IDL-based program instruction parsing via the internal Parser class.

- **TypeScript Native:** Written in TypeScript for better developer experience and type safety.

## Parsers

The parser accepts two types of IDL, the IDL which are compatible with `@coral-xyz/anchor` and `@project-serum/anchor`.

### Initialization
```javascript
import { Parser } from "ladybug";
import { Idl as coralXyzIdl } from "@coral-xyz/anchor";
import { Idl as projectSerumIdl } from "@project-serum/anchor";

const parser = new Parser();
parser.addIDL(new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"), pumpIdl as Idl);

```

Once this is initialized, we can decode both transactions and accounts using this parser.

```javascript
parser.parseTransaction(tx); //parsing transactions
parser.parseAccountData(rawAccount); //parsing account
```

## Transaction Streamers
We can stream parsed transactions using the `TransactionStreamer` class. It accepts your `gRPC url` and `x-token`, and a `parser` object to parse transactions.

### Initialization
```javascript
const parser = new Parser();
parser.addIDL(new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"), pumpIdl as Idl);
//initialzing parser, and adding IDL as show in previous step

const streamer = new TransactionStreamer("Your-gRPC-endpoint","access-token"); 
//initializing Streamer

streamer.addParser(parser);
//adding parser to the streamer
```

### Streaming Transactions
Once initialized, we can add the address for which we want to stream transactions

```javascript

streamer.addAddresses(["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"]);
//add address

streamer.onData(callbackFn) //adds a callback function to handle incoming data

streamer.start() //starts streaming transactions
```

We can stop streaming transactions in the following manner.
```javascript
streamer.stop() //stop streaming

streamer.removeAddresses(["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"]) //accepts a list of address and removes it
```


## Examples: Custom Parsers

### Initialization
```javascript
import { PumpFunStreamer } from "./dist";
const streamer = new PumpFunStreamer(process.env.ENDPOINT!, process.env.X_TOKEN);

```

### Getting all transactions

```javascript
streamer.onTransaction(processData);

streamer.startStreamingTransactions();

setTimeout(() => {
    console.log("\n\n\n\nStopping...\n\n\n\n");
    streamer.stopStreamingTransactions();
}, 8000);

async function processData(processed: any) {
  console.log("Processed:", processed);
}
```

### Getting All Accounts

```javascript
streamer.startStreamingAccounts();

streamer.onAccount(processData);

setTimeout(() => {
    console.log("\n\n\n\nStopping...\n\n\n\n");
    
    streamer.stopStreamingAccounts();
}, 8000);

async function processData(processed: any) {
  console.log("Processed:", processed);
}
```

### To detect specific Events: Buy/Sell

```javascript
streamer.onDetectedTransactionType("buy", processData);
streamer.onDetectedTransactionType("sell", processData);

async function processData(processed: any) {
  console.log("Processed:", processed);
}
```

### To detect specific Events: Token Launch

```javascript
streamer.onDetectedTransactionType("tokenLaunch", processMints);

async function processMints2(mint:string, tx: any) {
  console.log("Mint:", mint);
  console.log("Transaction:", tx);
}
```