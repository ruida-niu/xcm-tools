import type ExchangeChain from '../exchanges/ExchangeChain';
import type { TBuildTransactionsOptions, TPreparedExtrinsics, TTransformedOptions } from '../types';
import { createSwapTx } from './createSwapTx';
import {
  buildFromExchangeExtrinsic,
  buildSwapExecuteTx,
  buildToExchangeExtrinsic,
  canUseExecuteTransfer,
  isFilteredError,
  validateRoutedFeeAsset,
} from './utils';

export const prepareExtrinsics = async <TApi, TRes, TSigner, TCustomChain extends string = never>(
  dex: ExchangeChain,
  options: TTransformedOptions<
    TBuildTransactionsOptions<TApi, TRes, TSigner, TCustomChain>,
    TApi,
    TRes,
    TSigner,
    TCustomChain
  >,
): Promise<TPreparedExtrinsics<TRes>> => {
  const { api, origin, exchange, destination, sender } = options;

  if (canUseExecuteTransfer(dex, options)) {
    try {
      const { tx, amountOut } = await buildSwapExecuteTx(dex, options);
      // The execute payload carries its own slippage-protected minimum
      // internally (via calculateMinAmountOut), so the reported amountOut is
      // already the protected figure for the composed call.
      return { swapTxs: [tx], isExecute: true, amountOut, minDestinationAmount: amountOut };
    } catch (error) {
      if (!isFilteredError(error)) throw error;
      // Fall through to three-leg path
    }
  }

  validateRoutedFeeAsset(options);

  // 1. Create transfer origin -> exchange (optional)
  const toExchangeTx =
    origin && origin.chain !== exchange.chain
      ? await buildToExchangeExtrinsic({ ...options, origin })
      : undefined;

  // 2. Create swap in DEX (always)
  const { txs: swapTxs, amountOut, minDestinationAmount } = await createSwapTx(dex, options);

  // 3. Create transfer exchange -> destination (optional). The transfer must
  // never request more than the slippage-protected floor of the swap output,
  // otherwise the all-or-nothing batch fails on every price move inside the
  // slippage the user explicitly allowed.
  const toDestTx =
    destination && destination.chain !== exchange.chain
      ? await buildFromExchangeExtrinsic({
          exchange,
          destination,
          amount: minDestinationAmount,
          sender,
          api,
        })
      : undefined;

  return { toExchangeTx, swapTxs, toDestTx, amountOut: BigInt(amountOut), minDestinationAmount };
};
