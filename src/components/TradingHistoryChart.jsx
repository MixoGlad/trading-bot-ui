import React, { useMemo, useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useBinanceConfig } from '../context/BinanceConfigContext';
import CyberBorder from './CyberBorder';
import { placeTrade } from '../api/tradingApi';
import { useNotifier } from '../context/NotificationContext';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl">
        <p className="text-xs text-gray-500 font-semibold mb-1 uppercase">{label}</p>
        <p className="text-lg font-bold text-indigo-600">
          ${payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </p>
      </div>
    );
  }
  return null;
};

const TradingHistoryChart = ({ trades, onTradePlaced, signal }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [symbol, setSymbol] = useState('BTC');
  const [amount, setAmount] = useState('');
  const [currentPrice, setCurrentPrice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [priceError, setPriceError] = useState(false);

  const { addNotification } = useNotifier();
  const { binanceDomain } = useBinanceConfig();

  // Fetch real-time price from Binance when modal is open or symbol changes
  // Real-time price from Binance via WebSockets when modal is open
  useEffect(() => {
    if (!isModalOpen || !symbol) {
      setCurrentPrice(null);
      setPriceError(false);
      return;
    }

    const fetchBinancePrice = async () => {
      try {
        // Domain comes from global context, respecting regional overrides and failovers
        const url = `https://api.${binanceDomain}/api/v3/ticker/price?symbol=${symbol.toUpperCase()}USDT`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Price fetch failed');

        const data = await response.json();
        if (data.price) {
          setCurrentPrice(parseFloat(data.price));
          setPriceError(false);
        }
      } catch (err) {
        console.error('Binance price fetch error:', err);
        setPriceError(true);
      }
    };

    fetchBinancePrice();
    const interval = setInterval(fetchBinancePrice, 10000);

    // Binance WebSocket streams require the symbol to be lowercase
    const wsUrl = `wss://stream.${binanceDomain}:9443/ws/${symbol.toLowerCase()}usdt@ticker`;
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.c) setCurrentPrice(parseFloat(data.c));
    };

    socket.onerror = (error) => console.error('Binance WebSocket error:', error);

    return () => {
      clearInterval(interval);
      socket.close();
    };
  }, [isModalOpen, symbol, binanceDomain]);

  const chartData = useMemo(() => {
    if (!trades || trades.length === 0) return [];
    return [...trades]
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map((t) => ({
        time: new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        balance: t.balanceAfter,
      }));
  }, [trades]);

  const activeColor = useMemo(() => {
    if (signal === 'BUY') return '#10b981'; // Emerald
    if (signal === 'SELL') return '#ef4444'; // Red
    if (signal === 'HOLD') return '#f59e0b'; // Amber
    return '#6366f1'; // Indigo (default)
  }, [signal]);

  const handleTrade = async (e) => {
    e.preventDefault();
    if (!currentPrice) {
      alert('Cannot place trade: Live price connection is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await placeTrade({
        symbol,
        amount: Number(amount),
        price: currentPrice,
      });

      setIsModalOpen(false);
      setAmount('');
      if (onTradePlaced) onTradePlaced();
    } catch (err) {
      console.error('Trade error:', err);
      addNotification(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <CyberBorder className="w-full h-[450px]" signal={signal}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-black uppercase tracking-widest text-gray-800 dark:text-white">
              Growth Performance
            </h3>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold transition-all active:scale-95 shadow-lg hover:shadow-indigo-500/50 border-2 border-indigo-400/50"
            >
              + New Trade
            </button>
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={activeColor} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={activeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis dataKey="time" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="balance"
                stroke={activeColor}
                strokeWidth={4}
                fill="url(#colorBalance)"
                style={{ filter: `drop-shadow(0 0 6px ${activeColor}cc)` }}
                activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff', fill: activeColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CyberBorder>

      {/* Trade Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div
            className={`p-8 rounded-2xl shadow-2xl w-full max-w-md border transition-all duration-500 ${
              signal === 'BUY'
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500/30 shadow-emerald-500/10 animate-modal-buy-glow'
                : signal === 'SELL'
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-500/30 shadow-red-500/10'
                  : signal === 'HOLD'
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500/30 shadow-amber-500/10'
                    : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
            }`}
          >
            <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">
              Place New Order
            </h2>
            <form onSubmit={handleTrade} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Asset Symbol</label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
                {currentPrice && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <p className="text-xs text-green-600 font-bold uppercase">
                      Live Binance: $
                      {currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
                {priceError && !currentPrice && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    <p className="text-xs text-red-600 font-bold uppercase">
                      Price Connection Error (Verify Region/VPN)
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Quantity</label>
                <input
                  type="number"
                  step="0.0001"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full p-3 border rounded-xl dark:bg-gray-700 dark:border-gray-600 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {currentPrice && Number(amount) > 0 && (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                  <p className="text-xs text-indigo-500 dark:text-indigo-400 font-medium mb-1">
                    Estimated Total Cost
                  </p>
                  <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300">
                    $
                    {(currentPrice * Number(amount)).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 py-3 text-white font-bold rounded-xl transition-all shadow-lg disabled:bg-gray-400 ${
                    signal === 'BUY'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/40'
                      : signal === 'SELL'
                        ? 'bg-red-600 hover:bg-red-700 shadow-red-500/40'
                        : signal === 'HOLD'
                          ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/40'
                          : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/40'
                  }`}
                >
                  {isSubmitting ? 'Processing...' : 'Confirm Trade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default TradingHistoryChart;
