import { padValueBy } from '@paraspell/sdk-core';

export const pow10n = (d: number | bigint): bigint => {
  let result = 1n;
  const exp = BigInt(d);
  for (let i = 0n; i < exp; i++) result *= 10n;
  return result;
};

/**
 * Applies a slippage floor to a quoted output amount: the result is the quote
 * reduced by `slippagePct` percent (rounded down). When no slippage percentage
 * is provided the quote is returned unchanged, so callers that do not opt into
 * slippage protection keep the historical raw-quote behavior.
 */
export const applySlippageFloor = (amountOut: bigint, slippagePct?: string): bigint => {
  if (slippagePct === undefined) return amountOut;
  return padValueBy(amountOut, -Number(slippagePct));
};
