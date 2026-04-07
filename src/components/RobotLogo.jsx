import React, { useEffect } from 'react';

const RobotLogo = ({ isConnected, size = 40, className = '' }) => {
  // Green for connected, Red for disconnected
  const eyeColor = isConnected ? '#10B981' : '#EF4444';

  // Dynamically update the browser tab icon (favicon)
  useEffect(() => {
    const svgString = `
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>
        <rect x='20' y='30' width='60' height='50' rx='10' fill='#4F46E5'/>
        <rect x='30' y='20' width='40' height='15' rx='5' fill='#4338CA'/>
        <circle cx='40' cy='50' r='6' fill='${eyeColor}'/>
        <circle cx='60' cy='50' r='6' fill='${eyeColor}'/>
        <text x='50' y='72' font-family='Arial' font-weight='bold' font-size='18' fill='#F59E0B' text-anchor='middle'>₿</text>
        <path d='M50 20 V5 M45 5 H55' stroke='#4F46E5' stroke-width='4' stroke-linecap='round'/>
      </svg>`
      .trim()
      .replace(/\n/g, '');

    const link = document.querySelector("link[rel~='icon']");
    if (link) {
      link.href = `data:image/svg+xml,${encodeURIComponent(svgString)}`;
    }
  }, [isConnected, eyeColor]);

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className}>
      <style>
        {`.robot-eye { transition: fill 0.3s ease; }
          .pulsing { animation: eye-pulse 2s infinite ease-in-out; }
          @keyframes eye-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}
      </style>
      <rect x="20" y="30" width="60" height="50" rx="10" fill="#4F46E5" />
      <rect x="30" y="20" width="40" height="15" rx="5" fill="#4338CA" />
      <circle
        className={`robot-eye ${isConnected ? 'pulsing' : ''}`}
        cx="40"
        cy="50"
        r="6"
        fill={eyeColor}
      />
      <circle
        className={`robot-eye ${isConnected ? 'pulsing' : ''}`}
        cx="60"
        cy="50"
        r="6"
        fill={eyeColor}
      />
      <text
        x="50"
        y="72"
        fontFamily="Arial"
        fontWeight="bold"
        fontSize="18"
        fill="#F59E0B"
        textAnchor="middle"
      >
        ₿
      </text>
      <path d="M50 20 V5 M45 5 H55" stroke="#4F46E5" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
};

export default RobotLogo;
