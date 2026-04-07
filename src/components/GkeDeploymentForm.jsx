/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useNotifier } from '../context/NotificationContext';
import ConfirmationModal from './ConfirmationModal';
import { getGkeStatus, deployGkeCluster, deleteGkeCluster } from '../api/GkeApi';
import CyberBorder from './CyberBorder';

const GkeDeploymentForm = ({ initialConfig = {}, signal }) => {
  const { addNotification } = useNotifier();
  const [formData, setFormData] = useState({
    clusterName: initialConfig.clusterName || '',
    zone: initialConfig.zone || 'us-central1-a',
    nodeType: initialConfig.nodeType || 'e2-medium',
    numNodes: initialConfig.numNodes || 3,
    backendImage: initialConfig.backendImage || '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [clusterToDelete, setClusterToDelete] = useState(null);
  const [status, setStatus] = useState('IDLE'); // IDLE, PROVISIONING, ACTIVE, ERROR

  // Poll backend for status when in PROVISIONING state
  useEffect(() => {
    let pollInterval;
    if (status === 'PROVISIONING') {
      pollInterval = setInterval(async () => {
        try {
          const data = await getGkeStatus(formData.clusterName, formData.zone);

          if (data.status === 'RUNNING') {
            setStatus('ACTIVE');
            addNotification('GKE Cluster is now RUNNING and active.', 'success');
            clearInterval(pollInterval);
          } else if (data.status === 'ERROR' || data.status === 'DEGRADED') {
            setStatus('ERROR');
            addNotification(`Cluster reached an error state: ${data.statusMessage}`, 'error');
            clearInterval(pollInterval);
          }
        } catch (err) {
          console.error('Status polling failed', err);
        }
      }, 10000); // Check every 10 seconds
    }
    return () => clearInterval(pollInterval);
  }, [status, formData.clusterName, formData.zone, addNotification]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setErrors((prev) => ({ ...prev, [name]: undefined })); // Clear error on change
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const newErrors = {};
    // GKE cluster name validation:
    // - Must start with a lowercase letter.
    // - Can contain only lowercase letters, numbers, and hyphens.
    // - Must be between 1 and 63 characters long.
    // - Cannot end with a hyphen.
    if (!formData.clusterName) {
      newErrors.clusterName = 'Cluster name is required.';
    } else if (!/^[a-z][a-z0-9-]{0,61}[a-z0-9]$/.test(formData.clusterName)) {
      newErrors.clusterName =
        'Invalid cluster name. Must start with a lowercase letter, contain only lowercase letters, numbers, or hyphens, be between 1 and 63 characters, and not end with a hyphen.';
    }
    if (!formData.backendImage) {
      newErrors.backendImage = 'Backend container image is required.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      addNotification('Please correct the errors in the form.', 'error');
      return;
    }
    setIsLoading(true);
    setStatus('PROVISIONING');
    setProgress(0);

    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      if (currentProgress < 90) {
        currentProgress += 5;
        setProgress(currentProgress);
      }
    }, 150);

    try {
      await deployGkeCluster(formData);

      clearInterval(progressInterval);
      setProgress(100);
      addNotification(
        `Deployment successfully initialized for cluster: ${formData.clusterName}. Provisioning started...`,
        'success'
      );

      // Delay closing the loading state so the user sees the 100% completion
      setTimeout(() => {
        setIsLoading(false);
        setProgress(0);
      }, 1000);
    } catch (error) {
      clearInterval(progressInterval);
      console.error('GKE Deployment failed', error);
      setStatus('ERROR');
      addNotification(error.message, 'error');
      setIsLoading(false);
      setProgress(0);
    }
  };

  const handleDeleteClick = () => {
    setClusterToDelete(formData.clusterName);
    setShowDeleteConfirmation(true);
  };

  const confirmDelete = async () => {
    setShowDeleteConfirmation(false);
    setIsLoading(true);
    setStatus('PROVISIONING'); // Or a 'DELETING' status if you want to differentiate
    addNotification(`Attempting to delete cluster: ${clusterToDelete}`, 'info');

    try {
      await deleteGkeCluster(clusterToDelete);
      setStatus('IDLE');
      addNotification(`Cluster '${clusterToDelete}' successfully deleted.`, 'success');
    } catch (error) {
      addNotification(error.message, 'error');
      setStatus('ERROR');
    } finally {
      setIsLoading(false);
      setClusterToDelete(null);
    }
  };

  const renderStatusBadge = () => {
    switch (status) {
      case 'PROVISIONING':
        return (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shadow-sm">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
            PROVISIONING
          </div>
        );
      case 'ACTIVE':
        return (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-sm">
            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
            ACTIVE
          </div>
        );
      case 'ERROR':
        return (
          <div className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 shadow-sm">
            ERROR
          </div>
        );
      default:
        return (
          <div className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-600 shadow-sm">
            NOT DEPLOYED
          </div>
        );
    }
  };

  return (
    <CyberBorder className="mt-8" signal={signal}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            GKE Deployment Settings
          </h3>
          {renderStatusBadge()}
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Cluster Name
            </label>
            <input
              name="clusterName"
              type="text"
              value={formData.clusterName}
              onChange={handleChange}
              disabled={isLoading}
              placeholder="trading-bot-cluster"
              className="p-3 border rounded-xl dark:bg-gray-800 dark:border-white/10 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
              required
            />
            {errors.clusterName && (
              <p className="text-red-500 text-xs mt-1">{errors.clusterName}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Zone
            </label>
            <select
              name="zone"
              value={formData.zone}
              onChange={handleChange}
              disabled={isLoading}
              className="p-3 border rounded-xl dark:bg-gray-800 dark:border-white/10 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
            >
              <option value="us-central1-a">us-central1-a (Iowa)</option>
              <option value="us-east1-b">us-east1-b (S. Carolina)</option>
              <option value="europe-west1-c">europe-west1-c (Belgium)</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Number of Nodes
            </label>
            <input
              name="numNodes"
              type="number"
              min="1"
              max="10"
              value={formData.numNodes}
              onChange={handleChange}
              disabled={isLoading}
              className="p-3 border rounded-xl dark:bg-gray-800 dark:border-white/10 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Backend Container Image
            </label>
            <input
              name="backendImage"
              type="text"
              value={formData.backendImage}
              onChange={handleChange}
              disabled={isLoading}
              placeholder="gcr.io/my-project/backend:v1"
              className="p-3 border rounded-xl dark:bg-gray-800 dark:border-white/10 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
              required
            />
            {errors.backendImage && (
              <p className="text-red-500 text-xs mt-1">{errors.backendImage}</p>
            )}
          </div>

          <div className="flex flex-col justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-md hover:shadow-indigo-500/50 ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 border-2 border-indigo-400/50'
              }`}
            >
              {isLoading ? `Deploying... ${progress}%` : 'Initialize Deployment'}
            </button>
            {isLoading && (
              <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 mt-3">
                <div
                  className="bg-indigo-600 h-1.5 rounded-full shadow-[0_0_8px_rgba(79,70,229,0.6)]"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            )}
            {status === 'ACTIVE' && (
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={isLoading}
                className={`w-full py-3 mt-4 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-md hover:shadow-red-500/50 ${
                  isLoading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 active:scale-95 border-2 border-red-400/50'
                }`}
              >
                Delete Cluster
              </button>
            )}
          </div>
        </form>
      </div>
    </CyberBorder>
  );
};

export default GkeDeploymentForm;
