import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

function SessionWarningModal() {
  const { isWarningActive, extendSession, logout } = useContext(AuthContext);

  if (!isWarningActive) {
    return null;
  }

  return (
    <div className="session-warning-modal-backdrop">
      <div className="session-warning-modal">
        <h2>Session Expiring Soon</h2>
        <p>Your session is about to expire due to inactivity. Would you like to stay logged in?</p>
        <div className="modal-buttons">
          <button onClick={extendSession} className="modal-btn-primary">
            Stay Logged In
          </button>
          <button onClick={logout} className="modal-btn-secondary">
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

export default SessionWarningModal;
