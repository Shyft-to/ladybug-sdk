import { describe, expect, it } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";

import { decodeLiquidityStateV4 } from "../decoders/raydium-liquidity-state-v4";

const U64_FIELDS = [
  "status", "nonce", "maxOrder", "depth", "baseDecimal", "quoteDecimal", "state",
  "resetFlag", "minSize", "volMaxCutRatio", "amountWaveRatio", "baseLotSize",
  "quoteLotSize", "minPriceMultiplier", "maxPriceMultiplier", "systemDecimalValue",
  "minSeparateNumerator", "minSeparateDenominator", "tradeFeeNumerator",
  "tradeFeeDenominator", "pnlNumerator", "pnlDenominator", "swapFeeNumerator",
  "swapFeeDenominator", "baseNeedTakePnl", "quoteNeedTakePnl", "quoteTotalPnl",
  "baseTotalPnl", "poolOpenTime", "punishPcAmount", "punishCoinAmount",
  "orderbookToInitTime",
] as const;

const PUBKEY_FIELDS = [
  "baseVault", "quoteVault", "baseMint", "quoteMint", "lpMint", "openOrders",
  "marketId", "marketProgramId", "targetOrders", "withdrawQueue", "lpVault", "owner",
] as const;

/** Encodes a `LiquidityStateV4` buffer in the exact field order the decoder reads. */
function buildFixture() {
  const u64Values = Object.fromEntries(
    U64_FIELDS.map((field, i) => [field, 1000 + i]),
  ) as Record<(typeof U64_FIELDS)[number], number>;

  const pubkeyValues = Object.fromEntries(
    PUBKEY_FIELDS.map((field) => [field, Keypair.generate().publicKey]),
  ) as Record<(typeof PUBKEY_FIELDS)[number], PublicKey>;

  const swapAmounts = {
    swapBaseInAmount: 111n,
    swapQuoteOutAmount: 222n,
    swapBase2QuoteFee: 333,
    swapQuoteInAmount: 444n,
    swapBaseOutAmount: 555n,
    swapQuote2BaseFee: 666,
  };
  const lpReserve = 777;
  const padding = [1, 2, 3];

  const chunks: Buffer[] = [];
  const writeU64 = (v: number | bigint) => {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(BigInt(v));
    chunks.push(b);
  };
  const writeU128 = (v: bigint) => {
    const b = Buffer.alloc(16); // low 64 bits set, high 64 bits zero
    b.writeBigUInt64LE(v, 0);
    chunks.push(b);
  };
  const writePubkey = (pk: PublicKey) => chunks.push(pk.toBuffer());

  for (const field of U64_FIELDS) writeU64(u64Values[field]);
  writeU128(swapAmounts.swapBaseInAmount);
  writeU128(swapAmounts.swapQuoteOutAmount);
  writeU64(swapAmounts.swapBase2QuoteFee);
  writeU128(swapAmounts.swapQuoteInAmount);
  writeU128(swapAmounts.swapBaseOutAmount);
  writeU64(swapAmounts.swapQuote2BaseFee);
  for (const field of PUBKEY_FIELDS) writePubkey(pubkeyValues[field]);
  writeU64(lpReserve);
  for (const p of padding) writeU64(p);

  return {
    buffer: Buffer.concat(chunks),
    u64Values,
    pubkeyValues,
    swapAmounts,
    lpReserve,
    padding,
  };
}

describe("decodeLiquidityStateV4", () => {
  it("decodes every field at its documented offset", () => {
    const fixture = buildFixture();
    const decoded = decodeLiquidityStateV4(fixture.buffer);

    for (const field of U64_FIELDS) {
      expect(decoded[field]).toBe(fixture.u64Values[field]);
    }
    for (const field of PUBKEY_FIELDS) {
      expect(decoded[field]).toBe(fixture.pubkeyValues[field].toBase58());
    }
    expect(decoded.swapBaseInAmount).toBe(Number(fixture.swapAmounts.swapBaseInAmount));
    expect(decoded.swapQuoteOutAmount).toBe(Number(fixture.swapAmounts.swapQuoteOutAmount));
    expect(decoded.swapBase2QuoteFee).toBe(fixture.swapAmounts.swapBase2QuoteFee);
    expect(decoded.swapQuoteInAmount).toBe(Number(fixture.swapAmounts.swapQuoteInAmount));
    expect(decoded.swapBaseOutAmount).toBe(Number(fixture.swapAmounts.swapBaseOutAmount));
    expect(decoded.swapQuote2BaseFee).toBe(fixture.swapAmounts.swapQuote2BaseFee);
    expect(decoded.lpReserve).toBe(fixture.lpReserve);
    expect(decoded.padding).toEqual(fixture.padding);
  });

  it("throws on a truncated buffer", () => {
    expect(() => decodeLiquidityStateV4(Buffer.alloc(10))).toThrow();
  });
});
