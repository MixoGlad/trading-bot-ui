// Generates a random walk for price data to simulate market movement.
const generatePriceData = (startPrice, numPoints) => {
  const data = [];
  let currentPrice = startPrice;
  for (let i = 0; i < numPoints; i++) {
    // Simulate a random price change with some volatility
    const change = (Math.random() - 0.5) * (currentPrice * 0.05); // Up to 5% volatility
    currentPrice += change;
    data.push(currentPrice);
  }
  return data;
};

/**
 * Generates a list of mock trades for guest users to demonstrate the dashboard's features.
 * It creates a semi-realistic set of BUY and SELL orders based on a simple momentum
 * strategy over a generated price history.
 *
 * @returns {Array<Object>} An array of mock trade objects.
 */
export const generateMockTrades = () => {
  const trades = [];
  const symbols = ['BTCUSDT', 'ETHUSDT'];
  const now = Date.now();

  symbols.forEach((symbol) => {
    const startPrice = symbol === 'BTCUSDT' ? 68000 : 3500;
    const prices = generatePriceData(startPrice, 150); // 150 hours of data
    let holding = 0;

    for (let i = 0; i < prices.length; i++) {
      const timestamp = new Date(now - (prices.length - i) * 60 * 60 * 1000); // hourly trades
      const price = prices[i];
      let status = 'HOLD';
      let amount = 0;

      // Simple momentum strategy for mock trades: buy on upticks, sell on downticks
      if (i > 1) {
        if (prices[i] > prices[i - 1] && holding === 0) {
          status = 'BUY';
          amount = Math.random() * 0.1 + 0.01; // buy 0.01 to 0.11 units
          holding += amount;
        } else if (prices[i] < prices[i - 1] && holding > 0) {
          status = 'SELL';
          amount = holding; // Sell all holdings
          holding = 0;
        }
      }

      if (status !== 'HOLD') {
        trades.push({
          id: `${symbol}-${timestamp.getTime()}-${Math.random()}`,
          symbol,
          amount,
          price, // The usePortfolio hook needs a price to calculate chart data
          stopLoss: price * 0.95,
          status,
          timestamp,
        });
      }
    }
  });

  return trades.sort((a, b) => b.timestamp - a.timestamp);
};
