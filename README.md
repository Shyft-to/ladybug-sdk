# ladybug-sdk
A TypeScript SDK for streaming and parsing real-time Solana blockchain data using the Yellowstone gRPC service.

## Examples

### Initialization
```javascript
import { PumpFunStreamer } from "./dist";
const streamer = new PumpFunStreamer(process.env.ENDPOINT!, process.env.X_TOKEN);

```

### Getting all transactions

```javascript
streamer.startStreamingTransactions();

streamer.onTransaction(processData);

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