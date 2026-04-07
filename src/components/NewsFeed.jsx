/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';

const mockNews = {
  BTCUSDT: [
    'Bitcoin Approaches Key Resistance Level',
    'Institutional Investors Bullish on Bitcoin',
    'Bitcoin Network Difficulty Increases',
  ],
  ETHUSDT: [
    'Ethereum 2.0 Upgrade Nears Completion',
    'Ethereum Transaction Fees Drop',
    'DeFi Projects Flourishing on Ethereum',
  ],
  DOGEUSDT: [
    'Dogecoin Community Launches New Initiative',
    'Elon Musk Tweets About Dogecoin Again',
    'Dogecoin Sees Increased Adoption',
  ],
  WUSDT: [
    'Wormhole Announces New Partnerships',
    'Wormhole Adds Support for New Blockchains',
    'Wormhole Transactions Increase',
  ],

  ZAR: [
    'South African Rand Strengthens Against USD',
    'Rand Volatility Increases Amid Economic Uncertainty',
    'South Africa’s Central Bank Intervenes in Forex Market',
  ],
};

export const NewsFeed = ({ symbols }) => {
  const [news, setNews] = useState([]);

  useEffect(() => {
    if (symbols && symbols.length > 0) {
      const newNews = [];
      symbols.forEach((symbol) => {
        if (mockNews[symbol]) {
          newNews.push(...mockNews[symbol].map((headline) => ({ symbol, headline })));
        }
      });
      setNews(newNews);
    } else {
      setNews([]);
    }
  }, [symbols]);

  return (
    <div className="news-feed">
      <h4>Market News</h4>
      <ul>
        {news.map((item, index) => (
          <li key={index}>{item.headline}</li>
        ))}
      </ul>
    </div>
  );
};
