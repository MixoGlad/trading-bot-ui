import { useMemo } from 'react';

/**
 * Custom hook to calculate EMA50 and EMA200 indicators.
 * @param {Array} data - Chronological array of price data { date, close }.
 * @returns {Array} - Data with ema50 and ema200 properties.
 */
export const useTechnicalIndicators = (data) => {
  return useMemo(() => {
    if (!data || data.length === 0) return [];

    const calculateEMA = (series, period) => {
      const k = 2 / (period + 1);
      let ema = series[0].close; // Start with the first price
      
      return series.map((point, i) => {
        // Calculate EMA recursively: (Current Price * K) + (Previous EMA * (1 - K))
        ema = point.close * k + ema * (1 - k);
        return ema;
      });
    };

    const ema50 = calculateEMA(data, 50);
    const ema200 = calculateEMA(data, 200);

    return data.map((point, index) => ({
      ...point,
      ema50: ema50[index],
      ema200: ema200[index],
    }));
  }, [data]);
};