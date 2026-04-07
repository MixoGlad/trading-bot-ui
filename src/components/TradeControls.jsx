import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { placeTrade } from '../api/tradingApi';
import { COIN_DATA } from './coinData';
import { useNotifier } from '../context/NotificationContext';
import { AuthContext } from '../context/AuthContext';

function TradeControls({ onTradePlaced }) {
  const [symbol, setSymbol] = useState(COIN_DATA[0] ? `${COIN_DATA[0].key}USDT` : '');
  const [amount, setAmount] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addNotification } = useNotifier();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const numAmount = parseFloat(amount);
    const numStopLoss = parseFloat(stopLoss);

    if (isNaN(numAmount) || isNaN(numStopLoss) || numAmount <= 0 || numStopLoss <= 0) {
      addNotification('Amount and Stop Loss must be positive numbers.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const trade = { symbol, amount: numAmount, stopLoss: numStopLoss };
      const result = await placeTrade(trade);
      const tradeResult = result.trade || result; // Handle {trade, newBalance} or just trade
      addNotification(
        `Trade placed: ${tradeResult.symbol} - Status: ${tradeResult.status}`,
        'success'
      );
      if (onTradePlaced) {
        onTradePlaced(result);
      }
      setSymbol(COIN_DATA[0] ? `${COIN_DATA[0].key}USDT` : '');
      setAmount('');
      setStopLoss('');
    } catch (err) {
      const message = err.message.toLowerCase().includes('fetch')
        ? 'Could not connect to the server. Please check your network connection.'
        : err.message;
      addNotification(message, 'error');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {COIN_DATA.map((coin) => (
            <option key={coin.key} value={`${coin.key}USDT`}>
              {coin.title} ({coin.key}USDT)
            </option>
          ))}
        </select>
        <input
          required
          placeholder="Amount"
          type="number"
          step="any"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          required
          placeholder="Stop Loss"
          type="number"
          step="any"
          min="0"
          value={stopLoss}
          onChange={(e) => setStopLoss(e.target.value)}
        />
        <button type="submit" disabled={isSubmitting || !symbol || !amount || !stopLoss}>
          {isSubmitting ? 'Placing...' : 'Place Trade'}
        </button>
      </form>
    </>
  );
}

export default TradeControls;
