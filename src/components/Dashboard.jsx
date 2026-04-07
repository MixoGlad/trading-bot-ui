/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState, useRef, useMemo, memo, useCallback, useContext } from 'react';
import { timeFormat } from 'd3-time-format';
import { format } from 'd3-format';
import { getTrades, deleteTrade, placeTrade } from '../api/tradingApi';
import {
  pie as d3pie,
  arc as d3arc,
  line as d3Line,
  area as d3Area,
  curveMonotoneX,
} from 'd3-shape';
import { COIN_DATA } from './coinData';
import { useStaticPortfolioData } from '../hooks/useStaticPortfolioData';
import { useLivePortfolioValues } from '../hooks/useLivePortfolioValues';
import { useTheme } from '../context/ThemeContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { useTechnicalIndicators } from '../hooks/useTechnicalIndicators';
import { useNotifier } from '../context/NotificationContext';
import { AuthContext } from '../context/AuthContext';
import MatrixBackground from './MatrixBackground';
import RobotLogo from './RobotLogo';
import { getCurrentUser } from '../api/AuthApi';
import TradeControls from './TradeControls';
import { useBinanceConfig } from '../context/BinanceConfigContext';
import SentimentBar from './SentimentBar';
import ConfirmationModal from './ConfirmationModal';

const SymbolIcon = ({ symbol }) => {
  if (!symbol) return <span>❓</span>;
  const coin = COIN_DATA.find((c) => symbol.includes(c.key));
  const icon = coin ? coin.icon : '💰';
  const title = coin ? coin.title : symbol;
  const className = `symbol-icon${coin ? ' ' + coin.className : ''}`;

  return (
    <span className={className} title={title}>
      {icon}
    </span>
  );
};

const coinColorMapping = {
  BTC: '#f7931a',
  ETH: '#627eea',
  DOGE: '#c2a633',
  W: '#9945FF',
};

const getColorForSymbol = (symbol) => {
  const coin = COIN_DATA.find((c) => symbol.includes(c.key));
  return coin ? coinColorMapping[coin.key] : '#808080'; // default grey
};

const ValueWithFlash = ({ value, prefix = '', suffix = '', className = '', style = {} }) => {
  const [flashClass, setFlashClass] = useState('');
  const prevValue = useRef(value);

  useEffect(() => {
    if (value === prevValue.current) return;

    const isUp = value > prevValue.current;
    prevValue.current = value;

    setFlashClass(isUp ? 'flash-up' : 'flash-down');

    const timer = setTimeout(() => {
      setFlashClass('');
    }, 1000);

    return () => clearTimeout(timer);
  }, [value]);

  return (
    <span className={`${className} ${flashClass}`} style={style}>
      {prefix}
      {value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
      {suffix}
    </span>
  );
};

const PieChart = ({ data, width, height, onHover, hoveredSymbol }) => {
  const radius = Math.min(width, height) / 2;
  const totalValue = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const pie = d3pie()
    .value((d) => d.value)
    .sort(null);

  const arc = d3arc()
    .innerRadius(radius * 0.5) // Donut chart
    .outerRadius(radius);

  const arcs = pie(data);

  if (data.length === 0) {
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-color)',
          fontSize: '0.9rem',
        }}
      >
        No holdings
      </div>
    );
  }

  return (
    <svg width={width} height={height}>
      <g
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted
            ? `translate(${width / 2}px, ${height / 2}px) scale(1)`
            : `translate(${width / 2}px, ${height / 2}px) scale(0.5)`,
          transition:
            'transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.8s ease-out',
        }}
      >
        {arcs.map((d, i) => {
          const percentage = totalValue > 0 ? (d.data.value / totalValue) * 100 : 0;
          const [x, y] = arc.centroid(d);
          const isHovered = d.data.symbol === hoveredSymbol;
          const sliceColor = getColorForSymbol(d.data.symbol);

          return (
            <g
              key={i}
              className={`pie-slice ${isHovered ? 'highlighted' : ''}`}
              onMouseEnter={() => onHover(d.data.symbol)}
              onMouseLeave={() => onHover(null)}
              style={{
                transform: isHovered
                  ? `translate(${(x / radius) * 12}px, ${(y / radius) * 12}px)`
                  : 'translate(0,0)',
                transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              }}
            >
              <path
                d={arc(d)}
                fill={sliceColor}
                style={{
                  transition: 'fill 0.3s ease, filter 0.3s ease',
                  filter: isHovered
                    ? `drop-shadow(0 0 8px ${sliceColor})`
                    : `drop-shadow(0 0 3px ${sliceColor}88)`,
                }}
              >
                <title>
                  {d.data.symbol}: $
                  {d.data.value.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  ({percentage.toFixed(1)}%)
                </title>
              </path>
              {percentage > 5 && (
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  className="pie-label"
                >
                  {`${percentage.toFixed(0)}%`}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
};

const PortfolioChart = memo(({ data, width, height, theme }) => {
  if (!data || data.length === 0) return null;
  const padding = { top: 10, right: 20, bottom: 30, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const gridColor = theme === 'dark' ? '#2a2a2a' : '#e0e0e0';
  const textColor = theme === 'dark' ? '#d0d0d0' : '#333';
  const areaColor = theme === 'dark' ? 'rgba(38, 166, 154, 0.3)' : 'rgba(38, 166, 154, 0.1)';
  const lineColor = '#26a69a';

  const xMin = data[0].date.getTime();
  const xMax = data[data.length - 1].date.getTime();
  const yMin = Math.min(...data.map((d) => d.value));
  const yMax = Math.max(...data.map((d) => d.value));

  const xScale = (date) => ((date.getTime() - xMin) / (xMax - xMin)) * chartWidth;
  const yScale = (val) => chartHeight - ((val - yMin) / (yMax - yMin || 1)) * chartHeight;

  const areaGenerator = d3Area()
    .x((d) => xScale(d.date))
    .y0(chartHeight)
    .y1((d) => yScale(d.value))
    .curve(curveMonotoneX);

  return (
    <svg width={width} height={height}>
      <g transform={`translate(${padding.left}, ${padding.top})`}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = chartHeight * tick;
          const val = yMax - tick * (yMax - yMin);
          return (
            <g key={tick}>
              <line x1={0} y1={y} x2={chartWidth} y2={y} stroke={gridColor} strokeDasharray="3 3" />
              <text x={-10} y={y + 4} fill={textColor} fontSize="10" textAnchor="end">
                ${val >= 1000 ? format('.2s')(val) : val.toFixed(2)}
              </text>
            </g>
          );
        })}
        <path d={areaGenerator(data)} fill={areaColor} stroke={lineColor} strokeWidth={2} />
      </g>
    </svg>
  );
});

export const TradeChart = memo(({ data: initialData, width, height, theme }) => {
  const filteredData = useMemo(() => {
    return initialData.filter((d) => d.date && !isNaN(d.close)).sort((a, b) => a.date - b.date);
  }, [initialData]);

  const chartConfig = useMemo(() => {
    const padding = { top: 20, right: 50, bottom: 30, left: 10 };
    return {
      padding,
      chartWidth: width - padding.left - padding.right,
      chartHeight: height - padding.top - padding.bottom,
    };
  }, [width, height]);

  const scales = useMemo(() => {
    if (filteredData.length === 0) return null;
    const { chartWidth, chartHeight } = chartConfig;
    const xMin = filteredData[0].date.getTime();
    const xMax = filteredData[filteredData.length - 1].date.getTime();
    const yMin = Math.min(...filteredData.map((d) => d.close)) * 0.99;
    const yMax = Math.max(...filteredData.map((d) => d.close)) * 1.01;

    const xScale = (date) => ((date.getTime() - xMin) / (xMax - xMin)) * chartWidth;
    const yScale = (price) => chartHeight - ((price - yMin) / (yMax - yMin || 1)) * chartHeight;

    return { xScale, yScale, yMin, yMax };
  }, [filteredData, chartConfig]);

  const pathD = useMemo(() => {
    if (!scales || filteredData.length === 0) return '';
    return d3Line()
      .x((d) => scales.xScale(d.date))
      .y((d) => scales.yScale(d.close))
      .curve(curveMonotoneX)(filteredData);
  }, [filteredData, scales]);

  const ema50Path = useMemo(() => {
    if (!scales || filteredData.length === 0) return '';
    return d3Line()
      .x((d) => scales.xScale(d.date))
      .y((d) => scales.yScale(d.ema50))
      .curve(curveMonotoneX)(filteredData);
  }, [filteredData, scales]);

  const ema200Path = useMemo(() => {
    if (!scales || filteredData.length === 0) return '';
    return d3Line()
      .x((d) => scales.xScale(d.date))
      .y((d) => scales.yScale(d.ema200))
      .curve(curveMonotoneX)(filteredData);
  }, [filteredData, scales]);

  const grid = useMemo(() => {
    if (!scales) return null;
    const { chartWidth, chartHeight } = chartConfig;
    const { yMin, yMax } = scales;
    const textColor = theme === 'dark' ? '#d0d0d0' : '#333';
    const gridColor = theme === 'dark' ? '#2a2a2a' : '#e0e0e0';

    return [0, 0.25, 0.5, 0.75, 1].map((tick) => {
      const y = chartHeight * tick;
      const price = yMax - tick * (yMax - yMin);
      return (
        <g key={tick}>
          <line x1={0} y1={y} x2={chartWidth} y2={y} stroke={gridColor} strokeDasharray="3 3" />
          <text x={chartWidth + 5} y={y + 4} fill={textColor} fontSize="10">
            {price.toFixed(2)}
          </text>
        </g>
      );
    });
  }, [scales, chartConfig, theme]);

  if (filteredData.length === 0) return <p>Not enough data to display chart.</p>;

  const textColor = theme === 'dark' ? '#d0d0d0' : '#333';

  return (
    <svg width={width} height={height}>
      <g transform={`translate(${chartConfig.padding.left}, ${chartConfig.padding.top})`}>
        {grid}
        <path d={pathD} fill="none" stroke="#26a69a" strokeWidth="2" />
        {/* EMA Indicators */}
        <path d={ema50Path} fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.8" />
        <path d={ema200Path} fill="none" stroke="#8b5cf6" strokeWidth="1.5" opacity="0.8" />

        {/* Simple X-Axis Label */}
        <text x={0} y={chartConfig.chartHeight + 15} fill={textColor} fontSize="10">
          {timeFormat('%b %d')(filteredData[0].date)}
        </text>
        <text
          x={chartConfig.chartWidth}
          y={chartConfig.chartHeight + 15}
          fill={textColor}
          fontSize="10"
          textAnchor="end"
        >
          {timeFormat('%b %d')(filteredData[filteredData.length - 1].date)}
        </text>
      </g>
    </svg>
  );
});

function Dashboard() {
  const [trades, setTrades] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const chartContainerRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [chartKey, setChartKey] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const [visibleTradesCount, setVisibleTradesCount] = useState(10);
  const [hoveredSymbol, setHoveredSymbol] = useState(null);
  const [showRechargeOverlay, setShowRechargeOverlay] = useState(false);
  const [rechargeProgress, setRechargeProgress] = useState(0);
  const [isPanicModalOpen, setPanicModalOpen] = useState(false);
  const [trailingStops, setTrailingStops] = useState({});
  const [isAutoPilot, setIsAutoPilot] = useState(false);
  const [livePrices, setLivePrices] = useState({});
  const priceUpdateBuffer = useRef({});
  const priceUpdateTimer = useRef(null);

  const holdings = useMemo(() => {
    const h = {};
    trades.forEach((trade) => {
      if (!h[trade.symbol]) h[trade.symbol] = 0;
      if (trade.status === 'BUY') h[trade.symbol] += trade.amount;
      if (trade.status === 'SELL') h[trade.symbol] -= trade.amount;
    });
    return h;
  }, [trades]);

  const { signal, lastSymbol, enrichedTrades, portfolioHistory, chartData } =
    useLivePortfolioValues(trades, holdings, livePrices);

  const chartDataWithIndicators = useTechnicalIndicators(chartData);

  const {
    binanceDomain,
    binanceOverride,
    setBinanceOverride,
    connectionStatus,
    testConnection,
    latency,
  } = useBinanceConfig();
  const [signalHistory, setSignalHistory] = useState([]);

  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('notificationVolume');
    return saved !== null ? Number(saved) : 0.5;
  });
  const [exporting, setExporting] = useState(false);
  const prevSignal = useRef(null);
  const [filterSymbol, setFilterSymbol] = useState('');
  const [profitTarget, setProfitTarget] = useState(5);
  const [trailingStopLimit, setTrailingStopLimit] = useState(5);
  const [filterStatus, setFilterStatus] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'descending' });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { addNotification } = useNotifier();
  const { theme } = useTheme();
  const { authToken } = useContext(AuthContext);
  const buySound = useRef(new Audio('/sounds/buy_signal.mp3')); // Assuming you have these sound files
  const sellSound = useRef(new Audio('/sounds/sell_signal.mp3')); // Assuming you have these sound files
  const rechargeSound = useRef(new Audio('/sounds/recharge.mp3'));
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [tradeToDelete, setTradeToDelete] = useState(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => {
    return localStorage.getItem('isSoundEnabled') !== 'false';
  });

  const toggleSound = () => {
    setIsSoundEnabled((prev) => {
      localStorage.setItem('isSoundEnabled', !prev);
      return !prev;
    });
  };

  useEffect(() => {
    buySound.current.volume = volume;
    sellSound.current.volume = volume;
    rechargeSound.current.volume = volume;
  }, [volume]);

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    localStorage.setItem('notificationVolume', newVolume);
  };

  const playSignalSound = useCallback(
    (type) => {
      if (!isSoundEnabled) return;
      try {
        if (type === 'BUY') {
          buySound.current.currentTime = 0;
          buySound.current.play().catch(() => {});
        } else if (type === 'SELL') {
          sellSound.current.currentTime = 0;
          sellSound.current.play().catch(() => {});
        } else if (type === 'RECHARGE') {
          rechargeSound.current.currentTime = 0;
          rechargeSound.current.play().catch(() => {});
        }
      } catch (err) {
        console.error('Audio playback failed', err);
      }
    },
    [isSoundEnabled]
  );

  const fetchUserData = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (user && user.walletBalance !== undefined) {
        setWalletBalance(user.walletBalance);
      }
    } catch (error) {
      console.error('Failed to fetch user balance', error);
    }
  }, []);

  useEffect(() => {
    let intervalId = null;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      } else {
        if (!intervalId) {
          fetchUserData(); // Fetch immediately on becoming visible
          intervalId = setInterval(fetchUserData, 10000);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    intervalId = setInterval(fetchUserData, 10000); // Start polling

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchUserData]);

  const handleTradePlaced = useCallback(
    (result) => {
      // Support both backend response { trade, newBalance } and guest mode { ...trade }
      const trade = result.trade || result;

      // Update trailing stops based on the trade
      if (trade.status === 'BUY') {
        // Initialize trailing stop for new BUY positions
        setTrailingStops((prev) => ({
          ...prev,
          [trade.symbol]: {
            entryPrice: trade.price,
            currentPeakPrice: trade.price,
            trailingStopPrice: trade.price * (1 - trailingStopLimit / 100),
          },
        }));
      } else if (trade.status === 'SELL') {
        // Remove symbol from trailing stops on SELL
        setTrailingStops((prev) => {
          const newStops = { ...prev };
          delete newStops[trade.symbol];
          return newStops;
        });
      }
      setTrades((prev) => [trade, ...prev]);

      if (result.newBalance !== undefined) {
        setWalletBalance(result.newBalance);
      } else {
        fetchUserData();
      }
    },
    [fetchUserData, trailingStopLimit]
  );

  // --- AUTO-TRADING ENGINE ---
  // Automatically executes trades when signals change if Auto-Pilot is active
  useEffect(() => {
    if (!isAutoPilot || !signal || signal === 'HOLD' || !lastSymbol) return;

    // Prevent duplicate trades on the same signal instance
    if (prevSignal.current === signal) return;

    const executeAutoTrade = async () => {
      try {
        const amount = signal === 'BUY' ? 0.1 : holdings[lastSymbol] || 0;
        if (amount <= 0 && signal === 'SELL') return;

        addNotification(`Auto-Pilot: Executing ${signal} for ${lastSymbol}...`, 'info');

        const result = await placeTrade({
          symbol: lastSymbol,
          amount: amount,
          stopLoss: 0, // Automated trades default to strategy SL
        });

        handleTradePlaced(result);
        addNotification(
          `Auto-Pilot: Successfully ${signal === 'BUY' ? 'purchased' : 'sold'} ${lastSymbol}`,
          'success'
        );
        playSignalSound(signal);
      } catch (err) {
        console.error('Auto-Pilot trade failed', err);
        addNotification(err.message || 'Auto-Pilot execution error', 'error');
      }
    };

    executeAutoTrade();
    prevSignal.current = signal;
  }, [
    signal,
    isAutoPilot,
    lastSymbol,
    holdings,
    addNotification,
    handleTradePlaced,
    playSignalSound,
  ]);

  // --- GUEST LIVE RECHARGE ---
  // Simulates "Real-time" crypto transfers to guest wallets when balance is low
  useEffect(() => {
    if (authToken) return; // Only for guests

    if (walletBalance < 5000) {
      const injectLiquidity = () => {
        const boost = 15000;
        const newBalance = walletBalance + boost;
        setWalletBalance(newBalance);
        updateGuestBalance(newBalance); // Persist to localStorage for TradingApi
        setRechargeProgress(0);
        setShowRechargeOverlay(true); // Trigger the visual animation
        playSignalSound('RECHARGE');
        addNotification('⚡ LIVE: Network Stimulus Received +$15,000.00', 'success');

        // Update signal history to show "Recharge" event
        setSignalHistory((prev) =>
          [
            {
              signal: 'RECHARGE',
              timestamp: new Date(),
            },
            ...prev,
          ].slice(0, 10)
        );

        // Start the progress bar filling
        setTimeout(() => setRechargeProgress(100), 100);

        // Automatically hide the overlay after 4 seconds
        setTimeout(() => {
          setShowRechargeOverlay(false);
          setRechargeProgress(0);
        }, 4000);
      };

      const timer = setTimeout(injectLiquidity, 3000);
      return () => clearTimeout(timer);
    }
  }, [walletBalance, authToken, addNotification, playSignalSound]);

  // --- AUTO-PILOT PROFIT TAKING ---
  // Monitors active holdings and automatically sells if profit exceeds user-defined threshold
  useEffect(() => {
    if (!isAutoPilot || Object.keys(holdings).length === 0) return;

    const monitorProfit = async () => {
      for (const [symbol, amount] of Object.entries(holdings)) {
        if (amount <= 0) continue;

        const currentPrice = livePrices[symbol];
        // Find the latest purchase price for this symbol
        const entryTrade = enrichedTrades.find((t) => t.symbol === symbol && t.status === 'BUY');

        if (currentPrice && entryTrade) {
          const profitPct = (currentPrice - entryTrade.price) / entryTrade.price;

          // Trigger automatic sell at user-defined profit threshold
          if (profitPct >= profitTarget / 100) {
            try {
              addNotification(
                `💰 Profit Target Reached: ${symbol} is up ${(profitPct * 100).toFixed(2)}%. Executing Sell...`,
                'success'
              );

              const result = await placeTrade({
                symbol: symbol,
                amount: amount,
                stopLoss: 0,
              });

              handleTradePlaced(result);
              playSignalSound('SELL');
            } catch (err) {
              console.error(`Auto-Pilot profit take failed for ${symbol}`, err);
              addNotification(err.message || `Profit take failed for ${symbol}`, 'error');
            }
          }
        }
      }
    };

    monitorProfit();
  }, [
    livePrices,
    isAutoPilot,
    holdings,
    enrichedTrades,
    profitTarget,
    addNotification,
    handleTradePlaced,
    playSignalSound,
  ]);

  // --- AUTO-PILOT TRAILING STOP-LOSS ---
  // Monitors active holdings and automatically sells if price drops from peak by trailingStopLimit
  useEffect(() => {
    if (
      !isAutoPilot ||
      Object.keys(trailingStops).length === 0 ||
      Object.keys(livePrices).length === 0
    )
      return;

    const monitorTrailingStops = async () => {
      let updatedTrailingStops = { ...trailingStops };
      let tradesToExecute = [];

      for (const [symbol, stopInfo] of Object.entries(trailingStops)) {
        const currentPrice = livePrices[symbol];
        if (!currentPrice) continue;

        let { entryPrice, currentPeakPrice, trailingStopPrice } = stopInfo;

        // Update current peak price
        currentPeakPrice = Math.max(currentPeakPrice, currentPrice);

        // Calculate new trailing stop price based on the new peak
        const newTrailingStopPrice = currentPeakPrice * (1 - trailingStopLimit / 100);

        // If current price drops below trailing stop, trigger SELL
        if (currentPrice <= newTrailingStopPrice) {
          const amountToSell = holdings[symbol] || 0;
          if (amountToSell > 0) {
            tradesToExecute.push({ symbol, amount: amountToSell });
            // This symbol will be removed from trailingStops by handleTradePlaced after the SELL trade is confirmed.
          }
        } else {
          // Update trailing stop info if not triggered
          updatedTrailingStops[symbol] = {
            entryPrice,
            currentPeakPrice,
            trailingStopPrice: newTrailingStopPrice,
          };
        }
      }

      // Update trailingStops state first to reflect peak price updates
      setTrailingStops(updatedTrailingStops);

      // Execute trades
      for (const trade of tradesToExecute) {
        try {
          addNotification(`🚨 Trailing Stop-Loss Triggered: Selling ${trade.symbol}.`, 'warning');
          const result = await placeTrade({
            symbol: trade.symbol,
            amount: trade.amount,
            stopLoss: 0, // Trailing stop is the strategy, no additional SL
          });
          handleTradePlaced(result); // This will update trades and remove from trailingStops
          playSignalSound('SELL');
        } catch (err) {
          console.error(`Auto-Pilot trailing stop-loss failed for ${trade.symbol}`, err);
          addNotification(err.message || `Trailing Stop-Loss failed for ${trade.symbol}`, 'error');
        }
      }
    };

    const interval = setInterval(monitorTrailingStops, 3000); // Check every 3 seconds
    return () => clearInterval(interval);
  }, [
    livePrices,
    isAutoPilot,
    trailingStops,
    holdings,
    trailingStopLimit,
    addNotification,
    handleTradePlaced,
    playSignalSound,
  ]);

  // Initial setup of trailingStops when component mounts or auto-pilot is enabled
  useEffect(() => {
    if (
      !isAutoPilot ||
      enrichedTrades.length === 0 ||
      Object.keys(livePrices).length === 0 ||
      !trailingStopLimit
    )
      return;
    const initialTrailingStops = {};
    for (const symbol in holdings) {
      if (holdings[symbol] > 0 && !trailingStops[symbol]) {
        // Only initialize if not already tracked
        const entryTrade = enrichedTrades.find((t) => t.symbol === symbol && t.status === 'BUY');
        if (entryTrade) {
          const currentPrice = livePrices[symbol];
          if (currentPrice) {
            initialTrailingStops[symbol] = {
              entryPrice: entryTrade.price,
              currentPeakPrice: Math.max(entryTrade.price, currentPrice),
              trailingStopPrice:
                Math.max(entryTrade.price, currentPrice) * (1 - trailingStopLimit / 100),
            };
          }
        }
      }
    }
    setTrailingStops((prev) => ({ ...prev, ...initialTrailingStops }));
  }, [isAutoPilot, enrichedTrades, holdings, livePrices, trailingStopLimit, trailingStops]);

  // --- LIQUIDATION ENGINE ---
  // Stops Auto-Pilot and immediately sells all active holdings
  const executePanicSell = async () => {
    setIsAutoPilot(false);
    setPanicModalOpen(false); // Close modal before processing
    addNotification('🚨 PANIC: Stopping Auto-Pilot and liquidating all positions...', 'warning');

    const activeHoldings = Object.entries(holdings).filter(([_, amount]) => amount > 0);
    const liquidationLog = [];

    if (activeHoldings.length === 0) {
      addNotification('Liquidation skipped: No active positions found.', 'info');
      return;
    }

    for (const [symbol, amount] of activeHoldings) {
      try {
        const result = await placeTrade({
          symbol,
          amount,
          stopLoss: 0,
        });
        const trade = result.trade || result;
        liquidationLog.push(trade);
        handleTradePlaced(result);
      } catch (err) {
        console.error(`Liquidation failed for ${symbol}:`, err);
        addNotification(err.message || `Liquidation failed for ${symbol}`, 'error');
      }
    }

    if (liquidationLog.length > 0) {
      const headers = ['id', 'timestamp', 'symbol', 'amount', 'price', 'status'];
      const csvContent = [
        headers.join(','),
        ...liquidationLog.map((t) =>
          headers
            .map((h) => `"${h === 'timestamp' ? new Date(t[h]).toISOString() : t[h]}"`)
            .join(',')
        ),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `liquidation_results_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addNotification('Liquidation trade log has been exported.', 'success');
    }

    playSignalSound('SELL');
  };

  // Track Signal History
  useEffect(() => {
    if (signal && signal !== prevSignal.current) {
      setSignalHistory((prev) => [{ signal, timestamp: new Date() }, ...prev].slice(0, 10));
      if (isAutoPilot) playSignalSound(signal);
      prevSignal.current = signal;
    }
  }, [signal, isAutoPilot, playSignalSound]);

  const tradeTimestampFormat = useMemo(() => timeFormat('%b %d, %Y %I:%M:%S %p'), []);

  const sortedTrades = useMemo(() => {
    let sortableTrades = [...enrichedTrades].filter((trade) => {
      if (filterSymbol && !trade.symbol.includes(filterSymbol)) {
        return false;
      }
      if (filterStatus && trade.status !== filterStatus) {
        return false;
      }
      return true;
    });
    if (sortConfig.key) {
      sortableTrades.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableTrades;
  }, [enrichedTrades, sortConfig, filterSymbol, filterStatus]);

  useEffect(() => {
    return () => {
      if (priceUpdateTimer.current) {
        clearTimeout(priceUpdateTimer.current);
      }
    };
  }, []);

  const pieChartData = useMemo(() => {
    // Create a symbol-to-trade map once to allow O(1) lookups in the loop below
    const tradeMap = new Map(enrichedTrades.map((t) => [t.symbol, t]));

    return Object.entries(holdings)
      .map(([symbol, amount]) => {
        if (amount <= 0) return null;
        const latestTrade = tradeMap.get(symbol);
        const price = livePrices[symbol] || (latestTrade ? latestTrade.price : 0);
        const value = amount * price;
        if (value <= 0) return null;
        return { symbol, value };
      })
      .filter(Boolean);
  }, [holdings, enrichedTrades, livePrices]);

  // Make chart responsive
  useEffect(() => {
    const chartContainer = chartContainerRef.current;
    if (!chartContainer) return;

    const storedHeight = localStorage.getItem('chartHeight');
    if (storedHeight) {
      chartContainer.style.height = storedHeight;
    }

    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setWidth(width);
        setHeight(height);
      }
    });

    observer.observe(chartContainer);

    return () => {
      observer.unobserve(chartContainer);
    };
  }, []);

  // Effect to handle dragging the resizer
  useEffect(() => {
    const chartContainer = chartContainerRef.current;

    const handleMouseMove = (e) => {
      if (!isResizing || !chartContainer) return;
      e.preventDefault();
      const chartTop = chartContainer.getBoundingClientRect().top;
      const newHeight = e.clientY - chartTop;
      const minHeight = 450; // Corresponds to min-height in CSS

      if (newHeight >= minHeight) {
        chartContainer.style.height = `${newHeight}px`;
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.userSelect = '';
      if (chartContainer) {
        localStorage.setItem('chartHeight', chartContainer.style.height);
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (document.body) {
        document.body.style.userSelect = '';
      }
    };
  }, [isResizing]);

  const exportToCSV = () => {
    setExporting(true);
    const csvRows = [];
    const headers = Object.keys(enrichedTrades[0] || {}).filter((key) => key !== 'bb'); // remove bb
    csvRows.push(headers.join(','));

    enrichedTrades.forEach((trade) => {
      const values = headers.map((header) => {
        let value = trade[header];
        if (header === 'timestamp') {
          value = new Date(value).toISOString();
        }
        return `"${value}"`;
      });
      csvRows.push(values.join(','));
    });

    const csvData = csvRows.join('\n');
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', 'true');
    a.setAttribute('href', url);
    a.setAttribute('download', 'trade_history.csv');
    document.body.appendChild(a);
    a.click();
    setExporting(false);
  };

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return '';
    return sortConfig.direction === 'ascending' ? '▲' : '▼';
  };

  const handleResetChart = () => {
    setChartKey((prevKey) => prevKey + 1);
  };

  const handleLoadMore = () => {
    setVisibleTradesCount((prevCount) => prevCount + 10);
  };

  const handleMouseDownOnResizer = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleDeleteClick = (id) => {
    setTradeToDelete(id);
    setDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!tradeToDelete) return;
    try {
      await deleteTrade(tradeToDelete);
      setTrades((currentTrades) => currentTrades.filter((trade) => trade.id !== tradeToDelete));
      addNotification('Trade deleted successfully.', 'success');
    } catch (err) {
      const message = err.message.toLowerCase().includes('fetch')
        ? 'Could not connect to the server. Please check your network connection.'
        : err.message;
      addNotification(message, 'error');
      console.error('Failed to delete trade:', err);
    } finally {
      setDeleteModalOpen(false);
      setTradeToDelete(null);
    }
  };

  useEffect(() => {
    const initialFetch = async () => {
      // getTrades now handles guest mode via localStorage, allowing persistent trial usage
      setLoading(true);
      try {
        await fetchUserData(); // Fetch initial balance
        const data = await getTrades();
        setTrades(data);
      } catch (err) {
        // Don't show an error for guests, as this is expected.
        if (err.message !== 'Unauthorized') {
          const message = err.message.toLowerCase().includes('fetch')
            ? 'Could not connect to the server. Please check your network connection.'
            : err.message;
          addNotification(message, 'error');
          console.error('Failed to fetch trades:', err);
        }
      } finally {
        setLoading(false);
      }
    };

    initialFetch();
  }, [addNotification, authToken]);

  const handleWebSocketMessage = useCallback(
    (message) => {
      // This is an example. Adjust based on your backend's message format.
      if (message.type === 'tradeUpdate' && message.payload) {
        // Simple upsert: add new trade or replace existing one
        setTrades((currentTrades) => [
          message.payload,
          ...currentTrades.filter((t) => t.id !== message.payload.id),
        ]);
        addNotification(`New trade activity for ${message.payload.symbol}`, 'info');
      }

      if (message.type === 'priceUpdate' && message.payload) {
        // Add the new price to our buffer
        priceUpdateBuffer.current[message.payload.symbol] = message.payload.price;

        // If a flush isn't already scheduled, set a timer
        if (!priceUpdateTimer.current) {
          priceUpdateTimer.current = setTimeout(() => {
            setLivePrices((prevPrices) => ({
              ...prevPrices,
              ...priceUpdateBuffer.current,
            }));
            priceUpdateBuffer.current = {};
            priceUpdateTimer.current = null;
          }, 500); // Throttles state updates to once every 500ms
        }
      }
    },
    [addNotification]
  );

  // Use the browser's current location to construct a secure WebSocket URL.
  // This makes the connection robust whether running locally or deployed.
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/stream`;
  useWebSocket(authToken ? wsUrl : null, handleWebSocketMessage);

  // Simulate live market data for guests to make charts interactive/animated
  useEffect(() => {
    if (authToken) return;

    const interval = setInterval(() => {
      setLivePrices((prev) => {
        const next = { ...prev };
        // Seed if empty
        if (Object.keys(next).length === 0) {
          COIN_DATA.forEach((c) => {
            next[`${c.key}USDT`] = Math.random() * 2000 + 100;
          });
        }
        // Jitter existing prices
        Object.keys(next).forEach((key) => {
          const volatility = 0.002; // 0.2%
          const change = 1 + (Math.random() * volatility * 2 - volatility);
          next[key] *= change;
        });
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [authToken]);

  return (
    <div className="relative">
      <SentimentBar signal={signal} />
      <div className="chart-header">
        <div className="flex items-center gap-3 group relative">
          <RobotLogo isConnected={!loading} size={32} />
          <h2
            className={`m-0 animate-pulse bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent font-black tracking-tighter glitch-effect ${signal ? `signal-alert-${signal}` : ''}`}
            data-text="ByteCafe Dashboard"
          >
            ByteCafe Dashboard
          </h2>
          {!authToken && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest bg-amber-500/20 border border-amber-500/50 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)] ml-1">
              Trial Mode
            </span>
          )}
        </div>
        <div className="header-buttons">
          <button
            onClick={() => setIsAutoPilot(!isAutoPilot)}
            className={`export-btn ${isAutoPilot ? 'bg-emerald-600 border-emerald-400' : ''}`}
            title="Toggle Automated Trading based on signals"
          >
            {isAutoPilot ? '🤖 Auto-Pilot: ON' : '🦾 Enable Auto-Pilot'}
          </button>

          <div className="flex items-center gap-4 px-3 py-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                Target:
              </span>
              <input
                type="number"
                value={profitTarget}
                onChange={(e) => setProfitTarget(Math.max(0.1, parseFloat(e.target.value) || 0))}
                className="w-10 bg-transparent border-b border-emerald-500/50 text-xs font-mono text-emerald-500 focus:outline-none"
                title="Take profit percentage"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                Trail:
              </span>
              <input
                type="number"
                value={trailingStopLimit}
                onChange={(e) =>
                  setTrailingStopLimit(Math.max(0.1, parseFloat(e.target.value) || 0))
                }
                className="w-10 bg-transparent border-b border-red-500/50 text-xs font-mono text-red-500 focus:outline-none"
                title="Trailing stop-loss percentage"
              />
            </div>
          </div>

          <button
            onClick={() => setPanicModalOpen(true)}
            className={`export-btn bg-red-600/10 border-red-500/50 text-red-500 hover:bg-red-600 hover:text-white transition-all font-black uppercase tracking-tighter ${
              signal === 'SELL'
                ? 'animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.6)] border-red-500 bg-red-600/20'
                : ''
            }`}
            title="KILL SWITCH: Stop Auto-Pilot and SELL ALL holdings"
          >
            💥 Panic Sell All
          </button>

          <button onClick={exportToCSV} className="export-btn" disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <div className="flex items-center gap-2 relative">
            <select
              value={binanceOverride}
              onChange={(e) => {
                setBinanceOverride(e.target.value);
                // binanceDomain is used internally by testConnection via the context
                testConnection(e.target.value);
              }}
              className="reset-chart-btn font-mono text-xs"
              title="Manual Binance Endpoint Override"
            >
              <option value="auto">🌐 Auto-Region</option>
              <option value="binance.com">🌍 Binance.com</option>
              <option value="binance.us">🇺🇸 Binance.us</option>
            </select>
            <div
              className={`w-2.5 h-2.5 rounded-full border border-white/10 transition-all duration-500 ${
                connectionStatus === 'success'
                  ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]'
                  : connectionStatus === 'error'
                    ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.7)]'
                    : connectionStatus === 'testing'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-gray-500'
              }`}
              title={`Binance API Status: ${connectionStatus.toUpperCase()}`}
            />
            {connectionStatus === 'success' && (
              <div className="flex items-center gap-1.5 ml-1" title="Real-time Data Stream Active">
                <span className="relative flex h-2 w-2">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      latency !== null && latency < 50
                        ? 'bg-emerald-500'
                        : latency > 300
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                    }`}
                  ></span>
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      latency !== null && latency < 50
                        ? 'bg-emerald-600'
                        : latency > 300
                          ? 'bg-amber-600'
                          : 'bg-red-600'
                    }`}
                  ></span>
                </span>
                <span
                  className={`text-[10px] font-black uppercase tracking-tighter ${
                    latency !== null && latency < 50
                      ? 'text-emerald-500'
                      : latency > 300
                        ? 'text-amber-500'
                        : 'text-red-500'
                  }`}
                  title={
                    latency !== null && latency < 50
                      ? 'Network Quality: Excellent (Ultra-Low Latency)'
                      : latency > 300
                        ? 'Network Quality: Poor (High Latency)'
                        : 'Network Quality: Good'
                  }
                >
                  Live
                </span>
              </div>
            )}
            {connectionStatus === 'success' && latency !== null && (
              <span
                className={`flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-full border ${
                  latency < 50
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : latency < 300
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}
                title={`Latency: ${latency.toFixed(0)}ms`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    latency < 50 ? 'bg-emerald-400' : latency < 300 ? 'bg-amber-400' : 'bg-red-400'
                  }`}
                ></span>
                {latency.toFixed(0)}ms
              </span>
            )}
            {connectionStatus !== 'testing' && (
              <button
                onClick={() => testConnection()}
                className="reset-chart-btn text-xs px-2 py-1 flex items-center gap-1"
                title="Refresh Binance Connection Status"
              >
                <span className="text-[10px]">↻</span> Refresh
              </button>
            )}
          </div>
          <div className="sound-control-group">
            <button
              onClick={toggleSound}
              className="reset-chart-btn sound-toggle-btn"
              title={isSoundEnabled ? 'Disable Sound' : 'Enable Sound'}
            >
              {isSoundEnabled ? '🔊' : '🔇'}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="volume-slider"
              title={`Volume: ${Math.round(volume * 100)}%`}
            />
          </div>
          <button onClick={handleResetChart} className="reset-chart-btn">
            Reset View
          </button>
        </div>
      </div>
      <div className="chart-container" ref={chartContainerRef}>
        {loading ? (
          <div className="spinner-container">
            <div className="spinner"></div>
          </div>
        ) : chartDataWithIndicators.length > 0 && width > 0 && height > 0 ? (
          <TradeChart
            key={chartKey}
            data={chartDataWithIndicators}
            width={width}
            height={height}
            theme={theme}
          />
        ) : (
          <p>No chart data available.</p>
        )}
        <div className="chart-resizer" onMouseDown={handleMouseDownOnResizer}>
          <div className="resizer-handle" />
        </div>
      </div>

      <div
        className="trade-controls-section"
        style={{
          marginTop: '20px',
          padding: '20px',
          background: 'var(--card-bg)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <h3>Place Order</h3>
        <TradeControls onTradePlaced={handleTradePlaced} />
      </div>

      {portfolioHistory.length > 0 && (
        <div
          className="portfolio-chart-section"
          style={{
            marginTop: '20px',
            padding: '20px',
            background: 'var(--card-bg)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}
        >
          <h3>Total Portfolio Value</h3>
          <div style={{ height: '300px', width: '100%' }}>
            {width > 0 && (
              <PortfolioChart
                data={portfolioHistory}
                width={width - 80}
                height={300}
                theme={theme}
              />
            )}
          </div>
        </div>
      )}
      <div className="stats-container">
        <div className="balance-card">
          <h4>Current Signal</h4>
          <p className={`signal-${signal}`}>
            {signal === 'BUY' ? '🔼' : signal === 'SELL' ? '🔽' : '⏸️'} {signal}{' '}
            {lastSymbol && <SymbolIcon symbol={lastSymbol} />}
          </p>
        </div>
        <div className="balance-card">
          <h4>Available Cash</h4>
          <p>
            $
            {walletBalance.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            <ValueWithFlash value={walletBalance} prefix="$" />
          </p>
        </div>
        <div className="balance-card portfolio-card">
          <h4>Portfolio Distribution</h4>
          <div className="portfolio-content">
            <div className="pie-chart-container">
              <PieChart
                data={pieChartData}
                width={150}
                height={150}
                onHover={setHoveredSymbol}
                hoveredSymbol={hoveredSymbol}
              />
            </div>
            <ul className="holdings-list">
              {Object.entries(holdings).map(([symbol, amount]) => {
                if (amount === 0) return null;
                // Find the most recent trade for this symbol to get an approximate price
                const latestTrade = enrichedTrades.find((t) => t.symbol === symbol);
                const currentPrice = livePrices[symbol] || (latestTrade ? latestTrade.price : 0);
                const value = amount * currentPrice;
                const isHovered = symbol === hoveredSymbol;

                return (
                  <li
                    key={symbol}
                    className={isHovered ? 'highlighted' : ''}
                    onMouseEnter={() => setHoveredSymbol(symbol)}
                    onMouseLeave={() => setHoveredSymbol(null)}
                  >
                    <SymbolIcon symbol={symbol} />
                    <span>
                      {amount.toLocaleString()} {symbol}
                    </span>
                    <span style={{ marginLeft: 'auto', color: '#aaa' }}>
                      ($
                      {value.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      (
                      <ValueWithFlash value={value} prefix="$" />)
                    </span>
                  </li>
                );
              })}
              {Object.values(holdings).every((h) => h === 0) && (
                <li>
                  <span>No assets</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Signal History Sidebar */}
      <div className="signal-history-sidebar bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mt-8">
        <h3 className="text-lg font-black uppercase tracking-widest text-gray-800 dark:text-white mb-4">
          Signal History
        </h3>
        <ul>
          {signalHistory.map((entry, index) => (
            <li
              key={index}
              className={`flex justify-between items-center py-2 px-3 rounded-lg mb-2 last:mb-0 ${
                entry.signal === 'BUY'
                  ? 'bg-emerald-500/10 border border-emerald-500/20'
                  : entry.signal === 'SELL'
                    ? 'bg-red-500/10 border border-red-500/20'
                    : 'bg-amber-500/10 border border-amber-500/20'
              }`}
            >
              <span
                className={`signal-icon text-lg font-bold ${
                  entry.signal === 'BUY'
                    ? 'text-emerald-500'
                    : entry.signal === 'SELL'
                      ? 'text-red-500'
                      : 'text-amber-500'
                }`}
              >
                {entry.signal === 'BUY' ? '🔼' : entry.signal === 'SELL' ? '🔽' : '⏸️'}
              </span>
              <span
                className={`signal-text font-bold ${
                  entry.signal === 'BUY'
                    ? 'text-emerald-500'
                    : entry.signal === 'SELL'
                      ? 'text-red-500'
                      : 'text-amber-500'
                }`}
              >
                {entry.signal}
              </span>
              <span className="signal-timestamp text-xs text-gray-500 dark:text-gray-400 font-mono">
                {entry.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </li>
          ))}
          {signalHistory.length === 0 && (
            <li className="text-gray-500 dark:text-gray-400 text-center py-4">
              No signal changes yet.
            </li>
          )}
        </ul>
      </div>

      {!loading && sortedTrades.length > 0 ? (
        <>
          <div className="trade-history-header">
            <h3>Trade Log</h3>
          </div>
          <div className="trade-filters">
            <input
              type="text"
              placeholder="Filter by Symbol"
              value={filterSymbol}
              onChange={(e) => setFilterSymbol(e.target.value)}
            />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="BUY">Buy</option>
              <option value="SELL">Sell</option>
              <option value="HOLD">Hold</option>
            </select>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="Start Date"
              style={{
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg)',
                color: 'var(--text-color)',
              }}
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="End Date"
              style={{
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                background: 'var(--card-bg)',
                color: 'var(--text-color)',
              }}
            />
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="reset-chart-btn"
              style={{ marginLeft: '10px' }}
            >
              Reset Dates
            </button>
          </div>

          <table className="trade-history-table">
            <thead>
              <tr>
                <th onClick={() => requestSort('timestamp')}>
                  Date <span className="sort-indicator">{getSortIndicator('timestamp')}</span>
                </th>
                <th onClick={() => requestSort('symbol')}>
                  Symbol <span className="sort-indicator">{getSortIndicator('symbol')}</span>
                </th>
                <th onClick={() => requestSort('amount')}>
                  Amount <span className="sort-indicator">{getSortIndicator('amount')}</span>
                </th>
                <th onClick={() => requestSort('price')}>
                  Price <span className="sort-indicator">{getSortIndicator('price')}</span>
                </th>
                <th onClick={() => requestSort('status')}>
                  Status <span className="sort-indicator">{getSortIndicator('status')}</span>
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedTrades.slice(0, visibleTradesCount).map((trade) => (
                <tr key={trade.id}>
                  <td>
                    {trade.timestamp ? tradeTimestampFormat(new Date(trade.timestamp)) : 'No Date'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <SymbolIcon symbol={trade.symbol} />
                      {trade.symbol}
                    </div>
                  </td>
                  <td>{trade.amount.toFixed(4)} units</td>
                  <td>
                    @ $
                    {trade.price.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td>
                    <span className={`signal-${trade.status}`}>{trade.status}</span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleDeleteClick(trade.id)}
                      className="delete-btn"
                      title="Delete trade"
                    >
                      X
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleTradesCount < sortedTrades.length && (
            <div className="load-more-container">
              <button onClick={handleLoadMore} className="load-more-btn">
                Load More
              </button>
            </div>
          )}
        </>
      ) : (
        !loading && <p>No trades to display.</p>
      )}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={executeDelete}
        message="Are you sure you want to delete this trade?"
      />
      <ConfirmationModal
        isOpen={isPanicModalOpen}
        onClose={() => setPanicModalOpen(false)}
        onConfirm={executePanicSell}
        message="⚠️ CRITICAL ACTION: This will disable Auto-Pilot and immediately liquidate ALL active crypto positions at market price. Proceed with the kill-switch?"
      />

      {/* Visual Overlay for Guest Recharge */}
      {showRechargeOverlay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-2xl pointer-events-none transition-all duration-700">
          <div className="flex flex-col items-center text-center p-16 rounded-[5rem] border-4 border-emerald-500/50 bg-emerald-950/40 shadow-[0_0_100px_rgba(16,185,129,0.4)] animate-pulse">
            <div className="relative mb-8">
              {/* Ambient Glow */}
              <div className="absolute inset-0 bg-emerald-500 blur-[60px] opacity-60 animate-pulse"></div>
              {/* Bouncing Icon */}
              <span className="relative text-[10rem] animate-bounce inline-block drop-shadow-[0_0_30px_rgba(16,185,129,1)]">
                ⚡
              </span>
            </div>
            <h2 className="text-7xl font-black text-white italic tracking-tighter uppercase leading-none drop-shadow-2xl">
              Stimulus <br />
              <span className="text-emerald-500 bg-emerald-500/10 px-4">Injected</span>
            </h2>
            <div className="mt-12 flex flex-col items-center gap-4">
              <p className="text-lg font-mono text-emerald-400/80 uppercase tracking-[0.5em] font-bold">
                Transfer Verified
              </p>
              <div className="text-6xl font-black font-mono text-white bg-emerald-500/20 px-10 py-6 rounded-3xl border-2 border-emerald-500/50 shadow-inner">
                +$15,000.00
              </div>

              {/* Transaction Progress Bar */}
              <div className="w-full max-w-md bg-emerald-900/40 h-3 rounded-full mt-8 overflow-hidden border border-emerald-500/20 relative">
                <div
                  className="bg-emerald-500 h-full shadow-[0_0_20px_rgba(16,185,129,0.8)] transition-all ease-linear"
                  style={{
                    width: `${rechargeProgress}%`,
                    transitionDuration: '3900ms', // Matches the overlay display time
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite]"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
