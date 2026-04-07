import React from 'react';

const CyberBorder = ({ children, className = '', signal }) => {
  const getSignalClasses = () => {
    if (!signal) return 'border-indigo-500/30 group-hover:border-indigo-500';

    const colors = {
      BUY: 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]',
      SELL: 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]',
      HOLD: 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]',
    };

    return `${colors[signal] || 'border-indigo-500'} animate-pulse`;
  };

  return (
    <div className={`relative group ${className}`}>
      {/* Outer Glow/Blur effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>

      <div className="relative bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        {/* Cyber Corner Accents */}
        <div
          className={`absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 rounded-tl-3xl transition-all duration-500 group-hover:w-16 group-hover:h-16 pointer-events-none ${getSignalClasses()}`}
        ></div>
        <div
          className={`absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 rounded-tr-3xl transition-all duration-500 group-hover:w-16 group-hover:h-16 pointer-events-none ${getSignalClasses()}`}
        ></div>
        <div
          className={`absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 rounded-bl-3xl transition-all duration-500 group-hover:w-16 group-hover:h-16 pointer-events-none ${getSignalClasses()}`}
        ></div>
        <div
          className={`absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 rounded-br-3xl transition-all duration-500 group-hover:w-16 group-hover:h-16 pointer-events-none ${getSignalClasses()}`}
        ></div>

        {/* Internal Content Wrapper */}
        <div className="relative z-10">{children}</div>
      </div>
    </div>
  );
};

export default CyberBorder;
