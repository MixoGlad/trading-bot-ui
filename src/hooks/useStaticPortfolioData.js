import { useMemo } from 'react';

// NOTE: The calculation logic inside this file is a hypothetical implementation
// based on the usage in Dashboard.jsx. The key takeaway is the use of `useMemo`
// with specific dependency arrays to prevent expensive recalculations when only
// fast-updating data (like live prices) changes.

const calculateEnrichedTrades = (trades) => {
  if (!trades) return [];
  // Sort trades by timestamp descending to easily find the latest trade.
  // A real implementation would likely receive them sorted or sort once.
  return [...trades]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .map((trade) => ({
      ...trade,
      // Add any other derived properties if needed
    }));
};

const calculateHoldings = (enrichedTrades) => {
  const holdings = {};
  if (!enrichedTrades) return holdings;

  // Iterate backwards to calculate current holdings
  [...enrichedTrades].reverse().forEach((trade) => {
    const currentAmount = holdings[trade.symbol] || 0;
    if (trade.status === 'BUY') {
      holdings[trade.symbol] = currentAmount + trade.amount;
    } else if (trade.status === 'SELL') {
      holdings[trade.symbol] = currentAmount - trade.amount;
    }
  });
  return holdings;
};

const calculateChartData = (enrichedTrades, startDate, endDate) => {
  if (!enrichedTrades) return [];
  let data = enrichedTrades;
  if (startDate) {
    const start = new Date(startDate);
    data = data.filter((t) => new Date(t.timestamp) >= start);
  }
  if (endDate) {
    const end = new Date(endDate);
    data = data.filter((t) => new Date(t.timestamp) <= end);
  }
  // The chart expects data sorted ascending by date.
  return data.map((t) => ({ ...t, date: new Date(t.timestamp) })).sort((a, b) => a.date - b.date);
};

export const useStaticPortfolioData = (trades, loading, startDate, endDate) => {
  const enrichedTrades = useMemo(() => {
    if (loading || !trades) return [];
    // This calculation only depends on trades.
    return calculateEnrichedTrades(trades);
  }, [trades, loading]);

  const holdings = useMemo(() => {
    // This calculation only depends on the enriched trades.
    return calculateHoldings(enrichedTrades);
  }, [enrichedTrades]);

  const chartData = useMemo(() => {
    // This depends on enrichedTrades and date filters.
    return calculateChartData(enrichedTrades, startDate, endDate);
  }, [enrichedTrades, startDate, endDate]);

  const { signal, lastSymbol } = useMemo(() => {
    // The latest signal and symbol come from the most recent trade.
    const lastTrade = enrichedTrades.length > 0 ? enrichedTrades[0] : null;
    const signal = lastTrade ? lastTrade.status : 'HOLD';
    const lastSymbol = lastTrade ? lastTrade.symbol : null;
    return { signal, lastSymbol };
  }, [enrichedTrades]);

  return { enrichedTrades, holdings, chartData, signal, lastSymbol };
};