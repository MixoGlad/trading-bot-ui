import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { placeTrade } from './tradingApi';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 border border-gray-100 dark:border-gray-700 rounded-xl shadow-lg">
        <p className="text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">{label}</p>
        <p className="text-blue-600 dark:text-blue-400 font-bold text-base">
          $
          {payload[0].value.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
      </div>
    );
  }
  return null;
};

const TradingHistoryChart = ({ trades, onTradePlaced }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [symbol, setSymbol] = useState('BTC');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prepare data: Sort trades by time (oldest first) and format for Recharts
  const chartData = useMemo(() => {
    if (!trades || trades.length === 0) return [];

    // Create a copy to sort to avoid mutating the prop
    const sortedTrades = [...trades].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return sortedTrades.map((trade) => ({
      // Format date for the X-axis (e.g., "10/24 2:30 PM")
      date: new Date(trade.timestamp).toLocaleDateString(undefined, {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      balance: trade.balanceAfter,
      symbol: trade.symbol,
    }));
  }, [trades]);

  const handleTrade = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Using the shared API function instead of raw fetch
      await placeTrade({ symbol, amount: Number(amount), stopLoss: 0 }); // stopLoss 0 or handled by backend default
      setIsModalOpen(false);
      setAmount('');
      if (onTradePlaced) onTradePlaced();
    } catch (err) {
      console.error(err);
      alert('Failed to place trade: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 w-full h-96 relative">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-gray-700 dark:text-gray-200 text-lg font-bold">Balance History</h3>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
        >
          + New Trade
        </button>
      </div>
      {chartData.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-gray-400">
          <p>No trading history available yet.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              minTickGap={30}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              domain={['auto', 'auto']}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="balance"
              stroke="#4f46e5"
              strokeWidth={3}
              dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, fill: '#4f46e5' }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-sm transform transition-all">
            <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Quick Trade</h2>
            <form onSubmit={handleTrade}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">
                  Symbol
                </label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">
                  Amount
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  required
                  min="0.01"
                  step="0.01"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium shadow-sm"
                >
                  {isSubmitting ? 'Placing...' : 'Confirm Trade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingHistoryChart;
