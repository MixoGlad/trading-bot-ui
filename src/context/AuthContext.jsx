import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  login as apiLogin,
  logout as apiLogout,
  refreshToken,
  demoLogin as apiDemoLogin,
  register as apiRegister,
} from '../api/AuthApi';
import apiClient from '../api/axiosConfig';

const AuthContext = createContext(null);

// Helper to parse JWT and get expiration
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Invalid token for parsing:', e);
    return null;
  }
}

function AuthProvider({ children }) {
  const [authToken, setAuthToken] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isWarningActive, setIsWarningActive] = useState(false);
  const navigate = useNavigate();
  const isRefreshing = useRef(false);
  const failedQueue = useRef([]);

  const login = useCallback(
    async (email, password, rememberMe = false) => {
      try {
        // The backend now sets the refresh token in an HttpOnly cookie.
        // It returns the access token in the response body.
        const { token } = await apiLogin(email, password, rememberMe);
        if (token) {
          setAuthToken(token);
          return true;
        }
        // This error will be caught by the catch block below
        throw new Error('Login response did not include an access token.');
      } catch (error) {
        console.error('Login failed in AuthContext:', error);
        // Re-throw to be handled by the calling component (e.g., SignIn form)
        throw error;
      }
    },
    [setAuthToken]
  );

  const demoLogin = useCallback(async () => {
    try {
      const { token } = await apiDemoLogin();
      if (token) {
        setAuthToken(token);
        return true;
      }
      throw new Error('Demo login response did not include an access token.');
    } catch (error) {
      console.error('Demo login failed in AuthContext:', error);
      throw error;
    }
  }, [setAuthToken]);

  const register = useCallback(async (userData) => {
    try {
      // We don't automatically log in the user, just create the account.
      await apiRegister(userData);
    } catch (error) {
      console.error('Registration failed in AuthContext:', error);
      throw error; // Re-throw for the UI to handle.
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await apiLogout();
    } catch {
      // Even if the API call fails, we want to clear the token locally
      console.error('Logout API call failed');
    } finally {
      setAuthToken(null);
      navigate('/signin');
    }
  }, [navigate, setAuthToken]);

  const extendSession = useCallback(async () => {
    try {
      const { token } = await refreshToken();
      setAuthToken(token);
      setIsWarningActive(false); // Hide warning after successful refresh
    } catch {
      logout(); // Logout if refresh fails
    }
  }, [logout, setAuthToken]);

  // This effect manages session expiration warnings and proactive refresh based on JWT `exp`
  useEffect(() => {
    let warningTimer;
    let expirationTimer;

    if (authToken) {
      const decodedToken = parseJwt(authToken);
      if (decodedToken && decodedToken.exp) {
        const expirationTime = decodedToken.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        const expiresIn = expirationTime - now;

        // Show warning 2 minutes before expiration
        const WARNING_BEFORE_EXPIRATION = 2 * 60 * 1000;
        const warningTime = expiresIn - WARNING_BEFORE_EXPIRATION;

        if (warningTime > 0) {
          warningTimer = setTimeout(() => {
            setIsWarningActive(true);
          }, warningTime);
        }

        // Proactively refresh 1 minute before expiration.
        // This acts as a fallback if the user doesn't interact with the warning modal.
        const REFRESH_BEFORE_EXPIRATION = 1 * 60 * 1000;
        const refreshTime = expiresIn - REFRESH_BEFORE_EXPIRATION;

        if (refreshTime > 0) {
          expirationTimer = setTimeout(extendSession, refreshTime);
        } else if (expiresIn > 0) {
          // If we are already within the refresh window, try to extend immediately
          extendSession();
        } else {
          // If token is strictly expired
          console.log('Token already expired on load.');
          logout();
        }
      }
    }

    return () => {
      clearTimeout(warningTimer);
      clearTimeout(expirationTimer);
    };
  }, [authToken, logout, extendSession]);

  useEffect(() => {
    const checkAuthStatus = async () => {
      // On initial load, try to refresh the session.
      // If a valid HttpOnly refresh token cookie exists, this will succeed
      // and return a new access token.
      try {
        const data = await refreshToken();
        if (data?.token) {
          setAuthToken(data.token);
        }
      } catch {
        // This is expected if the user is not logged in.
        // Use functional update to ensure we don't overwrite a token potentially set by OAuth redirect
        setAuthToken((prev) => prev || null);
      }
      setIsAuthLoading(false);
    };

    checkAuthStatus();
  }, []);

  // This effect sets up the Axios interceptors for automatic token refresh.
  useEffect(() => {
    const processQueue = (error, token = null) => {
      failedQueue.current.forEach((prom) => {
        if (error) {
          prom.reject(error);
        } else {
          prom.resolve(token);
        }
      });
      failedQueue.current = [];
    };

    const requestInterceptor = apiClient.interceptors.request.use(
      (config) => {
        // Automatically add the user's local timezone to every request header
        config.headers['X-Timezone'] = Intl.DateTimeFormat().resolvedOptions().timeZone;

        if (authToken && !config.headers['Authorization']) {
          config.headers['Authorization'] = `Bearer ${authToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseInterceptor = apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        // The refresh token flow should not be retried.
        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          !originalRequest.url.includes('/auth/refresh')
        ) {
          if (isRefreshing.current) {
            return new Promise((resolve, reject) => {
              failedQueue.current.push({ resolve, reject });
            })
              .then((token) => {
                originalRequest.headers['Authorization'] = `Bearer ${token}`;
                return apiClient(originalRequest);
              })
              .catch((err) => Promise.reject(err));
          }

          originalRequest._retry = true;
          isRefreshing.current = true;

          try {
            const data = await refreshToken();
            if (!data) throw new Error('Session expired');

            const newToken = data.token;
            setAuthToken(newToken);
            processQueue(null, newToken);
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            return apiClient(originalRequest);
          } catch (refreshError) {
            processQueue(refreshError, null);
            logout();
            return Promise.reject(refreshError);
          } finally {
            isRefreshing.current = false;
          }
        }

        // If the error is a 502/503/504 (Server Down), we want to make sure 
        // it isn't swallowed so the GlobalErrorBoundary can detect the failure.
        if (error.response?.status >= 502) {
          console.error("Critical Gateway Error detected.");
        }

        return Promise.reject(error);
      }
    );

    return () => {
      apiClient.interceptors.request.eject(requestInterceptor);
      apiClient.interceptors.response.eject(responseInterceptor);
    };
  }, [authToken, logout, setAuthToken]);

  return (
    <AuthContext.Provider
      value={{
        authToken,
        login,
        demoLogin,
        register,
        setAuthToken,
        logout,
        isLoggingOut,
        isAuthLoading,
        isWarningActive,
        extendSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export { AuthProvider, AuthContext };
