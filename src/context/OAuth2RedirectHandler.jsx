import React, { useEffect, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useNotifier } from './NotificationContext';

function OAuth2RedirectHandler() {
  const { setAuthToken } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const { addNotification } = useNotifier();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const refreshToken = params.get('refreshToken');
    const error = params.get('error');

    if (error) {
      addNotification(error, 'error');
      navigate('/signin', { replace: true });
      return;
    }

    // The refresh token is now expected to be in an HttpOnly cookie,
    // so we only need to check for the access token in the URL.
    if (token) {
      setAuthToken(token);

      // Redirect to the dashboard or the originally intended page
      navigate('/dashboard', { replace: true });
    } else {
      // Handle cases where tokens are missing in a successful redirect
      addNotification('Authentication failed. The token is missing.', 'error');
      navigate('/signin', { replace: true });
    }
  }, [setAuthToken, location, navigate, addNotification]);

  // Render a loading indicator while the tokens are being processed
  return <div className="spinner-container">Logging you in...</div>;
}

export default OAuth2RedirectHandler;