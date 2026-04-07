import React, { useState, useEffect, useRef } from 'react';

const SentimentBar = ({ signal }) => {
  const [isGlitching, setIsGlitching] = useState(false);
  const prevSignal = useRef(signal);

  useEffect(() => {
    // Trigger glitch effect only when the signal actually changes
    if (signal && prevSignal.current && signal !== prevSignal.current) {
      setIsGlitching(true);
      const timer = setTimeout(() => setIsGlitching(false), 500);
      prevSignal.current = signal;
      return () => clearTimeout(timer);
    }
    prevSignal.current = signal;
  }, [signal]);

  if (!signal) return null;

  const config = {
    BUY: {
      color: 'from-emerald-600/0 via-emerald-500 to-emerald-600/0',
      glow: 'shadow-[0_0_20px_rgba(16,185,129,0.6)]',
    },
    SELL: {
      color: 'from-red-600/0 via-red-500 to-red-600/0',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.6)]',
    },
    HOLD: {
      color: 'from-amber-600/0 via-amber-500 to-amber-600/0',
      glow: 'shadow-[0_0_20px_rgba(245,158,11,0.6)]',
    },
  };

  const activeConfig = config[signal] || {
    color: 'from-indigo-600/0 via-indigo-500 to-indigo-600/0',
    glow: 'shadow-none',
  };

  return (
    <div
      className={`fixed top-0 left-0 w-full z-[60] pointer-events-none overflow-hidden ${isGlitching ? 'animate-sentiment-glitch' : ''}`}
    >
      {/* The Glow Layer */}
      <div
        className={`h-[2px] w-full bg-gradient-to-r ${activeConfig.color} ${activeConfig.glow} transition-all duration-1000 ease-in-out`}
      ></div>

      {/* Subtle secondary ambient wash */}
      <div
        className={`h-[40px] w-full bg-gradient-to-b ${activeConfig.color.replace('via-', 'from-').replace('to-', 'to-transparent')} opacity-5 transition-all duration-1000 ease-in-out`}
      ></div>
    </div>
  );
};

export default SentimentBar;
