import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { getCurrentUser } from '../api/AuthApi';
import { getTrades } from '../api/tradingApi';
import TradingHistoryChart from './TradingHistoryChart';
import { useNotifier } from '../context/NotificationContext';
import GkeDeploymentForm from './GkeDeploymentForm';
import { syncGke } from '../api/GkeApi';
import { useBinanceConfig } from '../context/BinanceConfigContext';
import RobotLogo from './RobotLogo';
import CyberBorder from './CyberBorder';

const Wallet = () => {
  const [user, setUser] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const { addNotification } = useNotifier();
  const { connectionStatus } = useBinanceConfig();

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
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSyncGKE = async () => {
    setIsSyncing(true);
    try {
      await syncGke();

      await fetchData();
      addNotification('Wallet successfully synchronized with GKE cluster', 'success');
    } catch (error) {
      console.error('GKE Sync failed', error);
      addNotification('Failed to sync with GKE cluster', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const currentSignal = useMemo(() => {
    if (!trades || trades.length === 0) return null;
    // Derive the overall terminal "mood" from the latest active trade signal
    return [...trades].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]?.status;
  }, [trades]);

  const plPercentage = useMemo(() => {
    const initial = 50000; // Baseline for demo/guest mode
    if (!user?.walletBalance) return 0;
    return ((user.walletBalance - initial) / initial) * 100;
  }, [user]);

  const gkeConfig = useMemo(
    () => ({
      clusterName: user?.username ? `${user.username}-trading-cluster` : '',
      zone: user?.preferredZone || 'us-central1-a',
      nodeType: 'e2-medium',
      numNodes: 3,
    }),
    [user]
  );

  if (loading) return <div className="p-8 text-center">Loading Wallet...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <RobotLogo isConnected={true} size={40} />
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-gray-800 dark:text-white tracking-tighter uppercase leading-none">
              Terminal
            </h1>
            <span className="text-[10px] font-mono text-indigo-500 font-bold tracking-[0.2em]">VAULT_v2.0.4</span>
          </div>
        </div>
        <button
          onClick={handleSyncGKE}
          disabled={isSyncing}
          className={`px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg hover:shadow-indigo-500/50 border-2 ${
            isSyncing
              ? 'bg-gray-400 border-gray-500 cursor-not-allowed text-white'
              : 'bg-indigo-600 border-indigo-400 hover:bg-indigo-700 text-white active:scale-95 hover:shadow-indigo-500/50'
          }`}
        >
          {isSyncing ? '🔄 Syncing...' : '☁️ Sync with GKE'}
        </button>
      </div>

      {/* Crypto-styled Balance Card */}
      <CyberBorder className="mb-10" signal={currentSignal}>
        <div className="p-8 text-gray-800 dark:text-white relative overflow-hidden">
          {/* Animated Scan Line */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/10 to-transparent h-32 w-full -translate-y-full animate-[scan_4s_linear_infinite] pointer-events-none"></div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-end">
            <div>
              <p className="text-xs font-black text-indigo-500 uppercase tracking-[0.4em] mb-3">
                Total Equity (USD)
              </p>
              <div className="flex items-baseline gap-4">
                <h2 className="text-6xl font-black font-mono tracking-tighter">
                  <span className="opacity-50 text-3xl mr-1">$</span>
                  {user?.walletBalance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </h2>
                <div
                  title="Calculated against an initial baseline of $50,000 for demo/guest mode."
                  className={`text-xl font-bold font-mono px-3 py-1 rounded-lg border ${
                    plPercentage >= 0
                      ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10'
                      : 'text-red-500 border-red-500/20 bg-red-500/10'
                  }`}
                >
                  {plPercentage >= 0 ? '+' : ''}
                  {plPercentage.toFixed(2)}%
                </div>
              </div>
            </div>
            <div className="mt-6 md:mt-0 bg-black/20 backdrop-blur-md border border-white/5 px-5 py-3 rounded-2xl shadow-inner">
              <div className="flex justify-between items-center gap-4 mb-2">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Network Status
                </p>
                <div
                  className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' :
                    connectionStatus === 'error' ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' :
                    'bg-amber-500 animate-pulse'
                  }`}
                />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-mono text-emerald-400 flex items-center gap-3">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  NODE_ACTIVE :: 0x71C...
                </p>
                <p className="text-[10px] font-mono text-gray-600 uppercase">Binance Endpoint: {connectionStatus}</p>
              </div>
            </div>
          </div>
        </div>
      </CyberBorder>

      <TradingHistoryChart trades={trades} onTradePlaced={fetchData} signal={currentSignal} />

      <GkeDeploymentForm initialConfig={gkeConfig} signal={currentSignal} />
    </div>
  );
};

export default Wallet;
