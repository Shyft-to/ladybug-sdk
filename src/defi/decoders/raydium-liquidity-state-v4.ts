import { PublicKey } from "@solana/web3.js";

/**
 * Decodes a Raydium AMM V4 `LiquidityStateV4` pool account.
 *
 * Raydium AMM V4 has no Anchor IDL, so the account is decoded by hand,
 * reading fields sequentially from the raw buffer.
 *
 * @param raw - The raw account data buffer.
 * @returns The decoded pool state as a plain object.
 */
export function decodeLiquidityStateV4(raw: Buffer): Record<string, unknown> {
  let off = 0;

  const u64 = (): number => {
    const v = raw.readBigUInt64LE(off);
    off += 8;
    return Number(v);
  };

  const u128 = (): number => {
    const lo = raw.readBigUInt64LE(off);
    const hi = raw.readBigUInt64LE(off + 8);
    off += 16;
    return Number(lo + (hi << 64n));
  };

  const pubkey = (): string => {
    const key = new PublicKey(raw.subarray(off, off + 32)).toBase58();
    off += 32;
    return key;
  };

  return {
    status:                  u64(),
    nonce:                   u64(),
    maxOrder:                u64(),
    depth:                   u64(),
    baseDecimal:             u64(),
    quoteDecimal:            u64(),
    state:                   u64(),
    resetFlag:               u64(),
    minSize:                 u64(),
    volMaxCutRatio:          u64(),
    amountWaveRatio:         u64(),
    baseLotSize:             u64(),
    quoteLotSize:            u64(),
    minPriceMultiplier:      u64(),
    maxPriceMultiplier:      u64(),
    systemDecimalValue:      u64(),
    minSeparateNumerator:    u64(),
    minSeparateDenominator:  u64(),
    tradeFeeNumerator:       u64(),
    tradeFeeDenominator:     u64(),
    pnlNumerator:            u64(),
    pnlDenominator:          u64(),
    swapFeeNumerator:        u64(),
    swapFeeDenominator:      u64(),
    baseNeedTakePnl:         u64(),
    quoteNeedTakePnl:        u64(),
    quoteTotalPnl:           u64(),
    baseTotalPnl:            u64(),
    poolOpenTime:            u64(),
    punishPcAmount:          u64(),
    punishCoinAmount:        u64(),
    orderbookToInitTime:     u64(),
    swapBaseInAmount:        u128(),
    swapQuoteOutAmount:      u128(),
    swapBase2QuoteFee:       u64(),
    swapQuoteInAmount:       u128(),
    swapBaseOutAmount:       u128(),
    swapQuote2BaseFee:       u64(),
    baseVault:               pubkey(),
    quoteVault:              pubkey(),
    baseMint:                pubkey(),
    quoteMint:               pubkey(),
    lpMint:                  pubkey(),
    openOrders:              pubkey(),
    marketId:                pubkey(),
    marketProgramId:         pubkey(),
    targetOrders:            pubkey(),
    withdrawQueue:           pubkey(),
    lpVault:                 pubkey(),
    owner:                   pubkey(),
    lpReserve:               u64(),
    padding:                 [u64(), u64(), u64()],
  };
}
