/* eslint-disable no-unused-vars */
import { getToken, handleApiError, getCurrentUser, updateGuestBalance } from './AuthApi';
import apiClient from './axiosConfig';
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const GUEST_TRADES_KEY = 'guest_trades_history';

const authHeader = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const getGuestTrades = () => {
  const stored = localStorage.getItem(GUEST_TRADES_KEY);
  if (stored) return JSON.parse(stored);

  // Generate initial mock data for attraction so the chart isn't empty
  const initialTrades = [];
  const now = new Date();
  let balance = 50000;

  for (let i = 0; i < 5; i++) {
    const time = new Date(now.getTime() - i * 3600000).toISOString(); // 1 hour apart
    const price = 30000 + Math.random() * 5000;
    const amount = 0.1;
    const cost = price * amount;
    // Simulate some history
    balance -= Math.random() > 0.5 ? cost : -cost * 1.1;

    initialTrades.push({
      id: `mock_${i}`,
      userId: 'guest',
      symbol: 'BTCUSDT',
      amount,
      price,
      status: 'CLOSED',
      timestamp: time,
      balanceAfter: balance,
    });
  }

  // Sync initial balance
  updateGuestBalance(balance);

  localStorage.setItem(GUEST_TRADES_KEY, JSON.stringify(initialTrades));
  return initialTrades;
};

export async function placeTrade(trade) {
  if (!getToken()) {
    const user = await getCurrentUser();
    const trades = getGuestTrades();

    // Simulate price
    const price = Math.random() * 1000 + 30000;
    const cost = price * trade.amount;

    if (user.walletBalance < cost) {
      throw new Error('Insufficient Funds (Trial Mode)');
    }

    const newBalance = user.walletBalance - cost;
    updateGuestBalance(newBalance);

    const newTrade = {
      id: `guest_${Date.now()}`,
      userId: user.id,
      symbol: trade.symbol,
      amount: trade.amount,
      price: price,
      status: 'OPEN',
      stopLoss: trade.stopLoss,
      timestamp: new Date().toISOString(),
      balanceAfter: newBalance,
    };

    trades.unshift(newTrade);
    localStorage.setItem(GUEST_TRADES_KEY, JSON.stringify(trades));
    return newTrade;
  }

  try {
    const response = await apiClient.post('/trades', trade);
    return response.data;
  } catch (err) {
    throw handleApiError(err);
  }
}

export async function deleteTrade(id) {
  if (!getToken()) {
    let trades = getGuestTrades();
    trades = trades.filter((t) => t.id !== id);
    localStorage.setItem(GUEST_TRADES_KEY, JSON.stringify(trades));
    return { message: 'Trade deleted', id };
  }

  try {
    const response = await apiClient.delete(`/trades/${id}`);
    return response.data;
  } catch (err) {
    throw handleApiError(err);
  }
}

export const getTrades = async () => {
  if (!getToken()) {
    return getGuestTrades();
  }

  try {
    const response = await apiClient.get('/trades');
    return response.data;
  } catch (err) {
    throw handleApiError(err);
  }
};
