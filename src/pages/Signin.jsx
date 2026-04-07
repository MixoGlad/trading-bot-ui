import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { socialLogin } from '../api/AuthApi';
import { AuthContext } from '../context/AuthContext';
import { useNotifier } from '../context/NotificationContext';
import './Auth.css';

function Signin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, demoLogin } = useContext(AuthContext);
  const navigate = useNavigate();
  const { addNotification } = useNotifier();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login(email, password, rememberMe);
      navigate('/dashboard');
    } catch (err) {
      addNotification(
        err.response?.data?.message || err.message || 'Failed to sign in. Please check your credentials.',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSocialLogin = (provider) => {
    socialLogin(provider);
  };

  const handleDemoLogin = async () => {
    setIsSubmitting(true);
    try {
      await demoLogin();
      navigate('/dashboard');
    } catch (err) {
      addNotification(
        err.message || 'Demo login failed. Please ensure the server is running.',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-side-visual">
        <svg
          className="btc-animated-icon"
          viewBox="0 0 1024 1024"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle className="btc-bg-circle" cx="512" cy="512" r="450" fill="none" />
          <path
            className="btc-path-fill"
            d="M685.1 402.7c15.8-63.5-38.6-96.6-104-119.2l21.2-85.2-51.9-12.9-20.7 83.1c-13.6-3.4-27.7-6.7-41.9-9.8l20.8-83.3-51.9-12.9-21.2 85.1c-11.4-2.6-22.5-5.1-33.5-7.7l-0.1-0.2-71.6-17.9-13.8 55.4s38.4 8.8 37.6 9.3c21 5.2 24.8 19.1 24.2 30.1l-24.2 97.2c1.5 0.4 3.3 0.9 5.4 1.7-1.7-0.4-3.5-0.8-5.4-1.3l-33.9 135.9c-2.6 6.4-9.1 15.9-23.8 12.3 0.6 0.8-37.6-9.4-37.6-9.4l-25.7 59.3 67.5 16.9c12.5 3.1 24.8 6.3 37.1 9.4l-21.5 86.2 51.9 12.9 21.3-85.3c14.3 3.9 28.2 7.6 42 11l-21.1 84.7 51.9 12.9 21.4-85.7c88.1 16.7 154.3 9.9 182-69.7 22.4-63.9-1.1-100.8-47.2-124.8 33.6-7.7 58.9-29.8 65.6-75.3zM586.4 712.5c-19.6 78.8-153.2 36.2-196.4 25.4l35.1-140.6c43.2 10.8 181.8 32.3 161.3 115.2zm26.4-184.3c-17.9 71.8-128.5 35.3-164.5 26.3l31.8-127.7c36 8.9 151.8 25.5 132.7 101.4z"
          />
        </svg>
        <div className="floating-icons">
          <span>♦</span>
          <span>Ð</span>
          <span>📈</span>
          <span>🤖</span>
          <span>₿</span>
          <span>♦</span>
          <span>Ð</span>
          <span>🤖</span>
          <span>📈</span>
          <span>₿</span>
        </div>
      </div>
      <div className="auth-form-container">
        <h2>Sign In</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <div className="remember-me">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <label htmlFor="rememberMe">Remember Me</label>
          </div>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
        <div className="divider">
          <span>OR</span>
        </div>
        <button onClick={handleDemoLogin} className="social-btn demo-btn" disabled={isSubmitting}>
          <span>Sign in as Demo User</span>
        </button>
        <div className="social-login-container">
          <button onClick={() => handleSocialLogin('google')} className="social-btn google-btn">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px">
              <path
                fill="#FFC107"
                d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
              ></path>
              <path
                fill="#FF3D00"
                d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
              ></path>
              <path
                fill="#4CAF50"
                d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.519-3.11-11.28-7.462l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
              ></path>
              <path
                fill="#1976D2"
                d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C44.57,34.637,48,29.692,48,24C48,22.659,47.862,21.35,47.611,20.083z"
              ></path>
            </svg>
            <span>Sign in with Google</span>
          </button>
          <button onClick={() => handleSocialLogin('github')} className="social-btn github-btn">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24px" height="24px">
              <path d="M12,2C6.477,2,2,6.477,2,12c0,4.419,2.865,8.166,6.839,9.49.5.092.682-.217.682-.482,0-.237-.009-.866-.014-1.699-2.782.604-3.369-1.342-3.369-1.342-.454-1.157-1.11-1.465-1.11-1.465-.908-.62.069-.608.069-.608,1.003.07,1.531,1.03,1.531,1.03.892,1.529,2.341,1.089,2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.949,0-1.091.39-1.984,1.03-2.682-.103-.253-.446-1.27.098-2.646,0,0,.84-.269,2.75,1.026A9.564,9.564,0,0,1,12,6.82c.85.004,1.705.115,2.504.336,1.909-1.295,2.747-1.026,2.747-1.026.546,1.376.202,2.393.1,2.646.64.698,1.028,1.59,1.028,2.682,0,3.847-2.338,4.692-4.566,4.94.359.308.678.92.678,1.854,0,1.338-.012,2.419-.012,2.746,0,.267.18.577.688.481A10.005,10.005,0,0,0,22,12C22,6.477,17.523,2,12,2Z"></path>
            </svg>
            <span>Sign in with GitHub</span>
          </button>
        </div>
        <div className="auth-links">
          <Link to="/forgot-password">Forgot Password?</Link>
          <p>
            Don't have an account? <Link to="/signup">Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Signin;
