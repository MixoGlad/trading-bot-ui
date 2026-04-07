import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { resetPassword } from '../api/AuthApi';
import { useNotifier } from '../context/NotificationContext';
import PasswordStrength from '../components/PasswordStrength';
import './Auth.css';

function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { token } = useParams();
  const navigate = useNavigate();
  const { addNotification } = useNotifier();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      addNotification('Passwords do not match.', 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await resetPassword(token, password);
      addNotification(response.message, 'success');
      navigate('/signin');
    } catch (err) {
      addNotification(
        err.message || 'Failed to reset password. The link may be invalid or expired.',
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
        <h2>Reset Password</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <PasswordStrength password={password} />
          <input
            type="password"
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ResetPassword;
