import React, { useContext, useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  Link,
  NavLink,
  Outlet,
} from 'react-router-dom';
import './App.css';
import './pages/Auth.css';
import Dashboard from './components/Dashboard';
import TradeControls from './components/TradeControls'; // This seems correct
import Signin from './pages/Signin';
import Wallet from './components/Wallet';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { getCurrentUser } from './api/AuthApi';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import SessionWarningModal from './components/SessionWarningModal';
import { BinanceConfigProvider, useBinanceConfig } from './context/BinanceConfigContext';
import MatrixBackground from './components/MatrixBackground';

function SubscriptionModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl text-center w-full max-w-md m-4">
        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
          Guest Trial Expired
        </h2>
        <p className="mb-6 text-gray-600 dark:text-gray-300">
          Thanks for trying out the trading bot! Your 24-hour guest session has ended. Please sign
          up to continue trading with a persistent wallet.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            to="/signup"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
          >
            Create Account
          </Link>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardHome() {
  return (
    <div className="container">
      <div className="dashboard">
        <Dashboard />
      </div>
      <div className="controls">
        <h2>Place a Trade</h2>
        <TradeControls />
      </div>
    </div>
  );
}

// This component holds the main application layout that should be protected
function MainLayout() {
  const { theme, toggleTheme } = useTheme();
  const { authToken, logout, isLoggingOut } = useContext(AuthContext);
  const { connectionStatus } = useBinanceConfig();
  const navigate = useNavigate();

  const [guestUser, setGuestUser] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [isSubscriptionModalOpen, setSubscriptionModalOpen] = useState(false);

  useEffect(() => {
    if (!authToken) {
      getCurrentUser().then((user) => {
        if (user && user.id === 'guest') {
          setGuestUser(user);
        }
      });
    }
  }, [authToken]);

  useEffect(() => {
    if (!guestUser || !guestUser.sessionStart) {
      return;
    }

    const sessionStartTime = new Date(guestUser.sessionStart).getTime();
    const trialDuration = 24 * 60 * 60 * 1000; // 24 hours

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const elapsed = now - sessionStartTime;
      const remaining = trialDuration - elapsed;

      if (remaining <= 0) {
        setTimeLeft(0);
        setSubscriptionModalOpen(true);
        clearInterval(interval);
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [guestUser]);

  const formatTime = (ms) => {
    if (ms === null || ms <= 0) return '00:00:00';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms / 1000 / 60) % 60);
    const seconds = Math.floor((ms / 1000) % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <MatrixBackground connectionStatus={connectionStatus} />
      {!authToken && (
        <div className="guest-mode-banner">
          You are in Guest Mode.
          {timeLeft !== null && (
            <span className="ml-4 font-mono bg-white/10 px-2 py-1 rounded text-sm">
              Trial ends in: {formatTime(timeLeft)}
            </span>
          )}
          <Link to="/signin" className="ml-4 underline">
            Sign in
          </Link>{' '}
          for the full experience.
        </div>
      )}
      <div className="header-container">
        <h1 className="glitch-effect" data-text="ByteCafe Terminal">
          <span className="icon">🤖</span>
          ByteCafe Terminal
        </h1>
        <div className="crypto-icons">
          <span title="Bitcoin">₿</span>
          <span title="Ethereum">♦</span>
          <span title="Dogecoin">Ð</span>
        </div>
        <nav style={{ display: 'flex', gap: '20px', margin: '0 20px' }}>
          <NavLink
            to="/dashboard"
            style={({ isActive }) => ({
              textDecoration: 'none',
              fontWeight: isActive ? 'bold' : 'normal',
              borderBottom: isActive ? '2px solid currentColor' : 'none',
              color: 'inherit',
            })}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/wallet"
            style={({ isActive }) => ({
              textDecoration: 'none',
              fontWeight: isActive ? 'bold' : 'normal',
              borderBottom: isActive ? '2px solid currentColor' : 'none',
              color: 'inherit',
            })}
          >
            Wallet
          </NavLink>
        </nav>
        <div className="header-actions">
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle Theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {authToken ? (
            <button onClick={logout} className="logout-btn" disabled={isLoggingOut}>
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </button>
          ) : (
            <button onClick={() => navigate('/signin')} className="login-btn">
              Sign In
            </button>
          )}
        </div>
      </div>

      <Outlet />
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
      />
    </>
  );
}

function AppRoutes() {
  const { authToken, isAuthLoading } = useContext(AuthContext);

  if (isAuthLoading) {
    return (
      <div className="spinner-container" style={{ height: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/dashboard" element={<DashboardHome />} />
        <Route path="/wallet" element={<Wallet />} />
      </Route>

      <Route path="/signin" element={authToken ? <Navigate to="/dashboard" /> : <Signin />} />
      <Route path="/signup" element={authToken ? <Navigate to="/dashboard" /> : <Signup />} />
      <Route
        path="/forgot-password"
        element={authToken ? <Navigate to="/dashboard" /> : <ForgotPassword />}
      />
      <Route
        path="/reset-password/:token"
        element={authToken ? <Navigate to="/dashboard" /> : <ResetPassword />}
      />

      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <BinanceConfigProvider>
              <AppRoutes />
              <SessionWarningModal />
            </BinanceConfigProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
