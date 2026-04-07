import React, { useEffect, useState, useCallback } from 'react';
import { getCurrentUser } from './AuthApi';
import { getTrades } from './tradingApi';
import TradingHistoryChart from './TradingHistoryChart';
import { useNotifier } from '../context/NotificationContext';

const Wallet = () => {
  const [user, setUser] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotifier();

  const fetchData = useCallback(async () => {
    try {
      const [userData, tradesData] = await Promise.all([getCurrentUser(), getTrades()]);
      setUser(userData);
      setTrades(tradesData);
    } catch (error) {
      console.error('Failed to fetch wallet data', error);
      addNotification('Failed to load wallet data', 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchData();
    let intervalId = null;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      } else {
        if (!intervalId) {
          fetchData(); // Fetch immediately on becoming visible
          intervalId = setInterval(fetchData, 10000);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    intervalId = setInterval(fetchData, 10000); // Start polling

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Wallet...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-800 dark:text-white">My Wallet</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Visual Wallet Card */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden h-64 flex flex-col justify-between">
          {/* Abstract circles for decoration */}
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
          <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-32 h-32 bg-purple-500 opacity-20 rounded-full blur-2xl"></div>

          <div className="relative z-10">
            <p className="text-blue-100 text-sm font-medium tracking-wider mb-1">PAPER BALANCE</p>
            <h2 className="text-4xl font-bold tracking-tight">
              $
              {user?.walletBalance?.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }) || '0.00'}
            </h2>
          </div>

          <div className="relative z-10 flex justify-between items-end">
            <div>
              <p className="text-blue-200 text-xs uppercase tracking-wider mb-1">Account Holder</p>
              <p className="font-medium text-lg">{user?.name || 'Trader'}</p>
            </div>
            <div className="text-right">
              <p className="text-blue-200 text-xs uppercase tracking-wider mb-1">Status</p>
              <span className="inline-block bg-white/20 px-2 py-1 rounded text-xs font-semibold backdrop-blur-sm border border-white/10">
                ACTIVE
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats or Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-center">
          <h3 className="text-gray-500 dark:text-gray-400 text-sm uppercase font-bold tracking-wider mb-4">
            Trading Activity
          </h3>
          <div className="text-5xl font-bold text-gray-800 dark:text-white mb-2">
            {trades.length}
          </div>
          <p className="text-gray-500">Total Trades Executed</p>
        </div>
      </div>

      {/* Chart Section */}
      <TradingHistoryChart trades={trades} onTradePlaced={fetchData} />
    </div>
  );
};

export default Wallet;
