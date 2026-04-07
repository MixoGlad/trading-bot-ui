import React, { useState, useCallback, useContext, createContext } from 'react';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const removeNotification = useCallback((id) => {
    setNotifications((current) => current.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback(
    (message, type = 'error', duration = 5000) => {
      const id = Date.now() + Math.random();
      setNotifications((current) => [...current, { id, message, type }]);

      if (duration) {
        setTimeout(() => {
          removeNotification(id);
        }, duration);
      }
    },
    [removeNotification]
  );

  return (
    <NotificationContext.Provider value={{ addNotification }}>
      {children}
      <div className="notification-container">
        {notifications.map((n) => (
          <div key={n.id} className={`notification notification-${n.type}`} role="alert">
            <span>{n.message}</span>
            <button
              onClick={() => removeNotification(n.id)}
              className="dismiss-btn"
              aria-label="Dismiss"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export const useNotifier = () => {
  const context = useContext(NotificationContext);
  if (context === undefined || context === null) {
    throw new Error('useNotifier must be used within a NotificationProvider');
  }
  return context;
};
