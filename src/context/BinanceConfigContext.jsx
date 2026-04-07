import React, { createContext, useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { useNotifier } from './NotificationContext';

const BinanceConfigContext = createContext();

export const BinanceConfigProvider = ({ children }) => {
  const { addNotification } = useNotifier();
  const [binanceOverride, setBinanceOverrideState] = useState(() => {
    return localStorage.getItem('binanceDomain') || 'auto';
  });
  const [fallbackDomain, setFallbackDomain] = useState(null);
  const [latency, setLatency] = useState(null); // New state for latency
  const [connectionStatus, setConnectionStatus] = useState('idle');

  const binanceDomain = useMemo(() => {
    if (fallbackDomain) return fallbackDomain;
    if (binanceOverride !== 'auto') return binanceOverride;

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const usZones = [
      'New_York',
      'Chicago',
      'Denver',
      'Los_Angeles',
      'Phoenix',
      'Anchorage',
      'Honolulu',
    ];
    return usZones.some((z) => tz.includes(z)) ? 'binance.us' : 'binance.com';
  }, [binanceOverride, fallbackDomain]);

  const testConnection = useCallback(async (domainToTest) => {
    setConnectionStatus('testing');

    const ping = async (domain) => { // Modified to return latency
      try {
        const startTime = performance.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`https://api.${domain}/api/v3/ping`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const endTime = performance.now();
        return { ok: response.ok, latency: endTime - startTime };
      } catch (err) {
        return { ok: false, latency: null };
      }
    };

    const primaryResult = await ping(domainToTest);
    if (primaryResult.ok) {
      setConnectionStatus('success');
      setLatency(primaryResult.latency);
      return;
    }

    // If primary failed and it was .com, try .us automatically if in auto mode
    if (domainToTest === 'binance.com' && binanceOverride === 'auto') {
      const fallbackResult = await ping('binance.us');
      if (fallbackResult.ok) {
        setFallbackDomain('binance.us');
        setConnectionStatus('success');
        setLatency(fallbackResult.latency);
        addNotification('binance.com is unreachable. Switched to binance.us failover.', 'warning');
        return;
      }
    }

    setConnectionStatus('error');
    setLatency(null); // Clear latency on error
  }, [binanceOverride, addNotification]);

  useEffect(() => {
    testConnection(binanceDomain);
  }, [binanceDomain, testConnection]);

  const setBinanceOverride = (val) => {
    setFallbackDomain(null); // Clear any automatic fallback when the user makes a manual choice
    setBinanceOverrideState(val);
    localStorage.setItem('binanceDomain', val);
    addNotification(`Binance endpoint updated to ${val === 'auto' ? 'Automatic' : val}`, 'info');
  };

  const value = {
    binanceDomain,
    binanceOverride,
    connectionStatus,
    setBinanceOverride,
    testConnection: () => testConnection(binanceDomain), // Ensure this calls with the current domain
    latency, // Expose latency
  };

  return <BinanceConfigContext.Provider value={value}>{children}</BinanceConfigContext.Provider>;
};

export const useBinanceConfig = () => {
  const context = useContext(BinanceConfigContext);
  if (!context) {
    throw new Error('useBinanceConfig must be used within a BinanceConfigProvider');
  }
  return context;
};
