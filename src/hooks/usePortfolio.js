import { useMemo } from 'react';

const INITIAL_BALANCE = 100000;

export function usePortfolio(trades, loading, livePrices = {}, startDate, endDate) {
  const { chartData, signal, lastSymbol, balance, holdings, enrichedTrades, portfolioHistory } =
    useMemo(() => {
      const dateFilteredTrades =
        startDate || endDate
          ? trades.filter((t) => {
              const tradeTime = new Date(t.timestamp).getTime();
              // If startDate is provided, parse it. Otherwise, it's negative infinity.
              const start = startDate ? new Date(startDate).getTime() : -Infinity;
              // If endDate is provided, parse it and set to end of day. Otherwise, it's positive infinity.
              const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Infinity;
              return tradeTime >= start && tradeTime <= end;
            })
          : trades;

      if (dateFilteredTrades.length === 0 && !loading) {
        return {
          chartData: [],
          signal: 'HOLD',
          lastSymbol: null,
          balance: INITIAL_BALANCE,
          holdings: {},
          enrichedTrades: [],
          portfolioHistory: [],
        };
      }

      const sortedTrades = [...dateFilteredTrades].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );

      const signal = sortedTrades.length > 0 ? sortedTrades[0].status : 'HOLD';
      const lastSymbol = sortedTrades.length > 0 ? sortedTrades[0].symbol : null;

      // --- Prepare more realistic data for the candlestick chart ---
      let lastPrice = 50000;
      const chronologicalTrades = [...sortedTrades].reverse();

      // More realistic price simulation with momentum
      const volatility = 0.02; // 2% volatility per step
      let momentum = 0; // Start with no momentum
      const momentumWeight = 0.8; // How much of the old momentum is kept (0-1)

      // Simple deterministic pseudo-random generator to keep the hook pure
      const seedRandom = (seed) => {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
      };

      const processedChartData = chronologicalTrades.map((trade, index) => {
        const open = lastPrice;

        // The random part of the price change
        // Use trade ID or index as a seed to ensure stability across re-renders
        // FIX: The seed for Math.sin must be a number. trade.id is a string,
        // which causes `Math.sin(string)` to return NaN, poisoning calculations.
        // We'll create a simple numeric hash from the string id.
        const seedString = String(trade.id || index);
        let seed = 0;
        for (let i = 0; i < seedString.length; i++) {
          seed += seedString.charCodeAt(i);
        }
        const r1 = seedRandom(seed + 0.1);
        const r2 = seedRandom(seed + 0.2);
        const r3 = seedRandom(seed + 0.3);

        const randomChange = (r1 - 0.5) * volatility;

        // The new change is a mix of momentum and randomness
        const percentChange = momentum + randomChange;
        let close = open * (1 + percentChange);

        // Update momentum for the next step. It's a weighted average of the old
        // momentum and the change we just applied. This creates a smoother trend.
        momentum = momentum * momentumWeight + percentChange * (1 - momentumWeight);

        const high = Math.max(open, close) * (1 + r2 * (volatility / 2));
        const low = Math.min(open, close) * (1 - r3 * (volatility / 2));
        lastPrice = close;
        return {
          date: new Date(trade.timestamp),
          open,
          high,
          low,
          close,
          volume: trade.amount,
          status: trade.status,
        };
      });

      const tradesWithPrice = chronologicalTrades.map((trade, index) => {
        return {
          ...trade,
          price: processedChartData[index].close,
        };
      });

      // --- Calculate Balance & Holdings ---
      let cashBalance = INITIAL_BALANCE;
      const currentHoldings = {};
      const priceMap = {};
      const portfolioHistory = [];

      // Add initial state
      if (tradesWithPrice.length > 0) {
        portfolioHistory.push({
          date: new Date(new Date(tradesWithPrice[0].timestamp).getTime() - 3600000),
          value: INITIAL_BALANCE,
        });
      }

      tradesWithPrice.forEach((trade) => {
        priceMap[trade.symbol] = trade.price;
        const cost = trade.price * trade.amount;

        if (!currentHoldings[trade.symbol]) currentHoldings[trade.symbol] = 0;

        if (trade.status === 'BUY') {
          cashBalance -= cost;
          currentHoldings[trade.symbol] += trade.amount;
        } else if (trade.status === 'SELL') {
          cashBalance += cost;
          currentHoldings[trade.symbol] -= trade.amount;
        }

        // Calculate total portfolio value at this point in time
        let currentAssetsValue = 0;
        Object.entries(currentHoldings).forEach(([sym, qty]) => {
          const p = priceMap[sym] || 0;
          currentAssetsValue += qty * p;
        });

        portfolioHistory.push({
          date: new Date(trade.timestamp),
          value: cashBalance + currentAssetsValue,
        });
      });

      // --- Calculate total portfolio value using live prices if available ---
      let assetValue = 0;
      Object.entries(currentHoldings).forEach(([symbol, amount]) => {
        const latestPrice =
          livePrices[symbol] || tradesWithPrice.find((t) => t.symbol === symbol)?.price || 0;
        assetValue += amount * latestPrice;
      });
      const totalPortfolioValue = cashBalance + assetValue;

      // --- Add current live data point to history for animation ---
      if (portfolioHistory.length > 0) {
        // We want the chart to look "alive", so we append the current calculated value
        // at the current time. This makes the line chart tick forward.
        const lastPoint = portfolioHistory[portfolioHistory.length - 1];
        // Only add if last trade wasn't just now (avoid dupes)
        if (new Date().getTime() - lastPoint.date.getTime() > 1000) {
          portfolioHistory.push({ date: new Date(), value: totalPortfolioValue });
        }
      }

      // --- Update Chart with Live Price ---
      const finalChartData = [...processedChartData];
      const chartSymbol = lastSymbol;
      if (chartSymbol && livePrices[chartSymbol] && finalChartData.length > 0) {
        const lastCandle = finalChartData[finalChartData.length - 1];
        const livePrice = livePrices[chartSymbol];

        // Update the last candle to reflect the current live price
        finalChartData[finalChartData.length - 1] = {
          ...lastCandle,
          close: livePrice,
          high: Math.max(lastCandle.high, livePrice),
          low: Math.min(lastCandle.low, livePrice),
        };
      }

      return {
        chartData: finalChartData,
        enrichedTrades: tradesWithPrice.sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        ),
        signal,
        lastSymbol,
        balance: totalPortfolioValue,
        holdings: currentHoldings,
        portfolioHistory,
      };
    }, [trades, loading, livePrices, startDate, endDate]);

  return { chartData, signal, lastSymbol, balance, holdings, enrichedTrades, portfolioHistory };
}
