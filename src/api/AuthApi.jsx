// src/api/AuthApi.js
import apiClient from './axiosConfig'; export { apiClient };
import axios from 'axios';

// Get token from localStorage
export const getToken = () => {
  // Return the token from localStorage for API calls outside of React Context
  return localStorage.getItem('token');
};

// Remove token
export const removeToken = () => {
  // Thoroughly wipe all client-side storage
  localStorage.clear();
  sessionStorage.clear();

  // Expire all accessible client-side cookies
  document.cookie.split(";").forEach((c) => {
    document.cookie = c
      .replace(/^ +/, "")
      .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });
};

// Login user
export const login = async (email, password, rememberMe) => {
  const response = await apiClient.post('/auth/login', { email, password, rememberMe });
  return response.data;
};

// Register user
export const register = async (userData) => {
  const response = await apiClient.post('/auth/register', userData);
  return response.data;
};

// Forgot password
export const forgotPassword = async (email) => {
  const response = await apiClient.post('/auth/forgot-password', { email });
  return response.data;
};

// Reset password
export const resetPassword = async (token, password) => {
  const response = await apiClient.post('/auth/reset-password', { token, password });
  return response.data;
};

// Logout user
export const logout = async () => {
  try {
    await apiClient.post('/auth/logout');
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    removeToken();
  }
};

// Get current user profile
export const updateGuestBalance = (balance) => {
  const guest = JSON.parse(localStorage.getItem('guest_user') || '{}');
  guest.walletBalance = balance;
  localStorage.setItem('guest_user', JSON.stringify(guest));
};

const getGuestUser = () => {
  let guest = localStorage.getItem('guest_user');
  if (!guest) {
    guest = {
      id: 'guest',
      name: 'Guest Trader',
      email: 'guest@example.com',
      walletBalance: 50000, // Initial trial balance
      sessionStart: new Date().toISOString(),
      role: 'guest',
    };
    localStorage.setItem('guest_user', JSON.stringify(guest));
  } else {
    guest = JSON.parse(guest);
  }
  return guest;
};

export const getCurrentUser = async () => {
  if (!getToken()) {
    return getGuestUser();
  }
  const response = await apiClient.get('/user/me');
  return response.data;
};

// Check if user is authenticated
export const isAuthenticated = () => {
  return !!getToken();
};

// Deposit funds (Simulation)
export const depositFunds = async (amount) => {
  if (!getToken()) {
    const guest = getGuestUser();
    guest.walletBalance += Number(amount);
    localStorage.setItem('guest_user', JSON.stringify(guest));
    return { message: 'Deposit successful', newBalance: guest.walletBalance };
  }
  const response = await apiClient.post('/user/deposit', { amount });
  return response.data;
};

// Withdraw funds (Simulation)
export const withdrawFunds = async (amount) => {
  if (!getToken()) {
    const guest = getGuestUser();
    if (guest.walletBalance < amount) {
      throw new Error('Insufficient funds');
    }
    guest.walletBalance -= Number(amount);
    localStorage.setItem('guest_user', JSON.stringify(guest));
    return { message: 'Withdrawal successful', newBalance: guest.walletBalance };
  }
  const response = await apiClient.post('/user/withdraw', { amount });
  return response.data;
};

export const getTransactions = async () => {
  const response = await apiClient.get('/transactions');
  return response.data;
};

// Refresh token (optional)
export const refreshToken = async () => {
  // Use a raw axios post to avoid interceptor loops.
  // Send `withCredentials: true` to ensure the browser sends the HttpOnly cookie.
  try {
    const response = await axios.post(
      '/api/auth/refresh',
      {},
      {
        withCredentials: true,
      }
    );
    return response.data;
  } catch (error) {
    // If the refresh fails with 401, the user simply has no active session.
    // Returning null allows AuthContext to handle this silently without a try/catch block.
    if (error.response?.status === 401) return null;
    throw error;
  }
};

// Social login (Google, GitHub, etc.)
export const socialLogin = (provider) => {
  window.location.href = `${import.meta.env.VITE_API_URL}/oauth2/authorization/${provider}`;
};

// Login as the demo user
export const demoLogin = async () => {
  // Use the existing login function with demo credentials
  return login('demo@example.com', 'password123', false);
};

// Helper to handle non-axios API errors (e.g. from fetch in TradingApi)
export const handleApiError = (error) => {
  let errorMessage = 'An unexpected error occurred';

  if (error.response) {
    // Server responded with a status code outside the 2xx range
    errorMessage = error.response.data?.message || error.response.data?.error || error.message;
  } else if (error.request) {
    // Request was made but no response was received (Network error)
    errorMessage = 'Network error: No response from server. Please check your connection.';
  } else {
    // Something happened in setting up the request
    errorMessage = error.message || errorMessage;
  }
  throw new Error(errorMessage);
};

/**
 * Transmits critical error details to the backend for persistent logging.
 */
export const logError = async (errorData) => {
  let userId = null;
  const token = getToken();

  // If the user is authenticated, extract the ID from the token
  if (token) {
    try {
      // Standard JWTs use a 3-part format; mock tokens may be simple base64 strings.
      const base64Payload = token.includes('.') ? token.split('.')[1] : token;
      const payload = JSON.parse(atob(base64Payload));
      userId = payload.id;
    } catch (e) {
      // Fallback if token is malformed or not a JSON object
    }
  }

  try {
    await apiClient.post('/logs/error', {
      ...errorData,
      userId,
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
  } catch (err) {
    // Silently fail logging to avoid infinite loops if the log endpoint is down
    console.warn('Telemetry transmission failed:', err.message);
  }
};

/**
 * Fetches error logs from the backend, optionally filtered by userId.
 */
export const getErrorLogs = async (userId, startDate, endDate) => {
  const response = await apiClient.get('/logs/error', {
    params: { userId, startDate, endDate },
  });
  return response.data;
};

/**
 * Clears all error logs from the database.
 */
export const clearErrorLogs = async () => {
  const response = await apiClient.delete('/logs/error');
  return response.data;
};

/**
 * Toggles a user's isActive status via administrative endpoint.
 */
export const toggleUserStatus = async (userId) => {
  const response = await apiClient.post(`/admin/users/${userId}/toggle-status`);
  return response.data;
};

export default {
  login,
  register,
  logout,
  getCurrentUser,
  isAuthenticated,
  getToken,
  removeToken,
  refreshToken,
  socialLogin,
  demoLogin,
  forgotPassword,
  resetPassword,
  handleApiError,
  depositFunds,
  withdrawFunds,
  apiClient,
  logError,
  getErrorLogs,
  clearErrorLogs,
  toggleUserStatus,
};
