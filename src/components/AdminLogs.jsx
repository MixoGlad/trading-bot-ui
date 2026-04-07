import React, { useState, useEffect, useCallback } from 'react';
import { getErrorLogs, getCurrentUser, clearErrorLogs, toggleUserStatus } from '../api/AuthApi';
import CyberBorder from './CyberBorder';
import { useNotifier } from '../context/NotificationContext';
import ConfirmationModal from './ConfirmationModal';

const AdminLogs = ({ signal }) => {
  const [logs, setLogs] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [userIdFilter, setUserIdFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingToggle, setIsProcessingToggle] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { addNotification } = useNotifier();

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getErrorLogs(userIdFilter, startDate, endDate);
      setLogs(data);
    } catch (err) {
      addNotification('Failed to retrieve system logs', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [userIdFilter, startDate, endDate, addNotification]);

  const handleClearLogs = async () => {
    try {
      await clearErrorLogs();
      setLogs([]);
      addNotification('System logs purged successfully.', 'success');
    } catch (err) {
      addNotification('Unauthorized or failed to clear logs.', 'error');
    } finally {
      setShowClearConfirm(false);
    }
  };

  const handleDownloadJSON = () => {
    if (logs.length === 0) {
      addNotification('No logs available to download.', 'warning');
      return;
    }

    const dataStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = `system_logs_${userIdFilter ? `user_${userIdFilter}_` : ''}${
      startDate ? `from_${startDate}_` : ''
    }${endDate ? `to_${endDate}_` : ''}${new Date().toISOString()}.json`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addNotification('Logs exported to JSON successfully.', 'success');
  };

  const handleToggleStatus = async (userId) => {
    if (!userId) return;
    setIsProcessingToggle(true);
    try {
      const result = await toggleUserStatus(userId);
      addNotification(result.message, 'success');
      // Update local log state to reflect the new status immediately
      setLogs((prev) =>
        prev.map((log) => (log.userId === userId ? { ...log, userActive: result.isActive } : log))
      );
    } catch (err) {
      addNotification(err.message || 'Failed to update user status', 'error');
    } finally {
      setIsProcessingToggle(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    const getUser = async () => {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
      } catch (e) {}
    };
    getUser();
  }, []);

  return (
    <>
      <CyberBorder className="mt-10" signal={signal}>
        <div className="p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h2 className="text-3xl font-black text-gray-800 dark:text-white tracking-tighter uppercase">
                Kernel Logs
              </h2>
              <p className="text-xs font-mono text-indigo-500 uppercase tracking-widest mt-1">
                Telemetry Stream :: System_Errors
              </p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <input
                type="text"
                placeholder="Filter by User ID..."
                value={userIdFilter}
                onChange={(e) => setUserIdFilter(e.target.value)}
                className="flex-1 md:w-64 bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-sm font-mono text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            <div className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-gray-400">
              <span>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-white outline-none"
              />
              <span className="ml-2">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-white outline-none"
              />
            </div>
              {userIdFilter && (
                <button
                  onClick={() => handleToggleStatus(userIdFilter)}
                  disabled={isProcessingToggle}
                  className="px-4 py-2 bg-amber-600/20 border border-amber-500/50 text-amber-500 rounded-xl hover:bg-amber-600 hover:text-white transition-all text-xs font-black uppercase tracking-tighter disabled:opacity-50"
                >
                  {isProcessingToggle ? '...' : 'Toggle Status'}
                </button>
              )}
              {logs.length > 0 && (
                <button
                  onClick={handleDownloadJSON}
                  className="px-4 py-2 bg-indigo-600/20 border border-indigo-500/50 text-indigo-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all text-xs font-black uppercase tracking-tighter"
                  title="Download JSON for Audit"
                >
                  Export JSON
                </button>
            )}
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="p-2 bg-gray-600/20 border border-white/10 rounded-xl hover:bg-gray-600 transition-all text-gray-400"
                title="Clear Date Range"
              >
                ✕
              </button>
              )}
              {currentUser?.role === 'admin' && (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="px-4 py-2 bg-red-600/20 border border-red-500/50 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all text-xs font-black uppercase tracking-tighter"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={fetchLogs}
                className="p-2 bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all text-white"
                title="Refresh Stream"
              >
                ↻
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead className="text-gray-500 uppercase tracking-wider border-b border-white/5">
                <tr>
                  <th className="pb-4 pl-2">Timestamp</th>
                  <th className="pb-4">Type</th>
                  <th className="pb-4">User_ID</th>
                  <th className="pb-4">Message</th>
                  <th className="pb-4">Actions</th>
                  <th className="pb-4 pr-2 text-right">Route</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-white/5 transition-colors group">
                    <td className="py-4 pl-2 text-gray-400">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-4">
                      <span
                        className={`px-2 py-0.5 rounded ${
                          log.errorType === 'API_FATAL'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {log.errorType}
                      </span>
                    </td>
                    <td className="py-4 text-indigo-400">
                      <div className="flex items-center gap-2">
                        {log.userId || <span className="opacity-30">GUEST</span>}
                        {log.userId && log.userActive !== undefined && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                              log.userActive
                                ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                                : 'bg-red-500 shadow-[0_0_8px_#ef4444]'
                            }`}
                            title={log.userActive ? 'Account Active' : 'Account Deactivated'}
                          />
                        )}
                      </div>
                    </td>
                    <td className="py-4 max-w-xs truncate text-gray-300" title={log.message}>
                      {log.message}
                    </td>
                    <td className="py-4">
                      {log.userId && (
                        <button
                          onClick={() => handleToggleStatus(log.userId)}
                          disabled={isProcessingToggle}
                          className="text-[10px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-2 py-1 rounded hover:bg-indigo-500 hover:text-white transition-all uppercase font-bold disabled:opacity-50"
                        >
                          Toggle
                        </button>
                      )}
                    </td>
                    <td className="py-4 pr-2 text-right text-gray-500 italic">
                      {log.url ? new URL(log.url).pathname : 'N/A'}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan="5" className="py-10 text-center text-gray-600 italic">
                      No anomalous activity detected in current sector.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {isLoading && (
            <div className="w-full h-1 bg-indigo-500/20 overflow-hidden mt-4">
              <div className="w-full h-full bg-indigo-500 animate-[loading_2s_infinite]"></div>
            </div>
          )}
        </div>
      </CyberBorder>

      <ConfirmationModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearLogs}
        message="⚠️ WARNING: You are about to permanently delete all system error logs. This action cannot be undone. Proceed?"
      />
    </>
  );
};

export default AdminLogs;
