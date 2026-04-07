import { useMemo, useRef, useCallback } from 'react';

const INITIAL_BALANCE = 100000;
const PRICE_CHANGE_THRESHOLD = 0.0001; // 0.01%

const calculateCashBalance = (enrichedTrades) => {
  if (!enrichedTrades?.length) return INITIAL_BALANCE;

  return enrichedTrades.reduce((balance, trade) => {
    const cost = trade.amount * trade.price;
    return trade.status === 'BUY' ? balance - cost : balance + cost;
  }, INITIAL_BALANCE);
};

const calculateHoldingsValue = (holdings, livePrices) => {
  return Object.entries(holdings).reduce((total, [symbol, amount]) => {
    return total + amount * (livePrices[symbol] || 0);
  }, 0);
};

// New function with better historical calculation (requires historical prices)
const calculatePortfolioHistory = (enrichedTrades, historicalPrices, cashBalance, holdings) => {
  if (!enrichedTrades?.length) return [];

  const sortedTrades = [...enrichedTrades].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  const history = [];
  let runningCash = INITIAL_BALANCE;
  const runningHoldings = {};

  sortedTrades.forEach((trade) => {
    // Update cash and holdings
    if (trade.status === 'BUY') {
      runningCash -= trade.amount * trade.price;
      runningHoldings[trade.symbol] = (runningHoldings[trade.symbol] || 0) + trade.amount;
    } else if (trade.status === 'SELL') {
      runningCash += trade.amount * trade.price;
      runningHoldings[trade.symbol] = (runningHoldings[trade.symbol] || 0) - trade.amount;
    }

    // Calculate holdings value using historical prices for that timestamp
    let holdingsValue = 0;
    for (const [symbol, amount] of Object.entries(runningHoldings)) {
      const historicalPrice = historicalPrices?.[symbol]?.[trade.timestamp] || trade.price;
      holdingsValue += amount * historicalPrice;
    }

    history.push({
      date: new Date(trade.timestamp),
      value: runningCash + holdingsValue,
    });
  });

  // Add final live point
  if (history.length > 0) {
    const finalHoldingsValue = calculateHoldingsValue(holdings, historicalPrices?.latest || {});
    history.push({
      date: new Date(),
      value: cashBalance + finalHoldingsValue,
    });
  }

  return history;
};

// Improved dead-banding with proper new symbol handling
const shouldUpdatePrice = (newPrice, lastPrice) => {
  if (lastPrice === 0) return true; // New symbol
  if (newPrice === lastPrice) return false;

  const percentChange = Math.abs(newPrice - lastPrice) / lastPrice;
  return percentChange > PRICE_CHANGE_THRESHOLD;
};

export const useLivePortfolioValues = (
  enrichedTrades,
  holdings,
  livePrices,
  historicalPrices = {} // Add historical prices as optional parameter
) => {
  const lastStablePrices = useRef({});
  const lastPricesHash = useRef('');

  // Memoize stable prices with improved comparison
  const stablePrices = useMemo(() => {
    // Quick hash check for significant changes
    const pricesHash = Object.entries(livePrices)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([symbol, price]) => `${symbol}:${price}`)
      .join('|');

    if (pricesHash === lastPricesHash.current) {
      return lastStablePrices.current;
    }

    let hasSignificantChange = false;
    const nextPrices = { ...lastStablePrices.current };

    for (const [symbol, newPrice] of Object.entries(livePrices)) {
      const lastPrice = lastStablePrices.current[symbol] || 0;

      if (shouldUpdatePrice(newPrice, lastPrice)) {
        nextPrices[symbol] = newPrice;
        hasSignificantChange = true;
      }
    }

    if (hasSignificantChange) {
      lastStablePrices.current = nextPrices;
      lastPricesHash.current = pricesHash;
    }

    return lastStablePrices.current;
  }, [livePrices]);

  const cashBalance = useMemo(() => calculateCashBalance(enrichedTrades), [enrichedTrades]);

  const holdingsValue = useMemo(
    () => calculateHoldingsValue(holdings, stablePrices),
    [holdings, stablePrices]
  );

  const totalPortfolioValue = useMemo(
    () => cashBalance + holdingsValue,
    [cashBalance, holdingsValue]
  );

  // Only recalculate history when dependencies actually change
  const portfolioHistory = useMemo(() => {
    if (!enrichedTrades?.length) return [];

    return calculatePortfolioHistory(enrichedTrades, historicalPrices, cashBalance, holdings);
  }, [enrichedTrades, historicalPrices, cashBalance, holdings]);

  // Memoize derived data
  const latestTrade = enrichedTrades?.[0];
  const signal = useMemo(() => latestTrade?.status || 'HOLD', [latestTrade]);
  const lastSymbol = useMemo(() => latestTrade?.symbol || null, [latestTrade]);

  // Optimize chart data generation with proper sorting and filtering
  const chartData = useMemo(() => {
    if (!enrichedTrades?.length) return [];

    return enrichedTrades
      .filter((t) => t?.price && t?.timestamp)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map((t) => ({
        date: new Date(t.timestamp),
        close: t.price,
        // Add optional OHLC data if available
        open: t.price,
        high: t.price,
        low: t.price,
      }));
  }, [enrichedTrades]);

  // Return memoized object to prevent unnecessary re-renders
  return useMemo(
    () => ({
      balance: totalPortfolioValue,
      portfolioHistory,
      signal,
      lastSymbol,
      enrichedTrades,
      chartData,
      cashBalance, // Expose for debugging if needed
      holdingsValue, // Expose for debugging if needed
    }),
    [
      totalPortfolioValue,
      portfolioHistory,
      signal,
      lastSymbol,
      enrichedTrades,
      chartData,
      cashBalance,
      holdingsValue,
    ]
  );
};
