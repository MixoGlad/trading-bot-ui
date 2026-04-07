/**
 * Utility for GKE-related API calls.
 * Handles authentication and error management.
 */

const getAuthHeaders = (includeJson = true) => {
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  if (includeJson) headers['Content-Type'] = 'application/json';
  return headers;
};

export const getGkeStatus = async (clusterName, zone) => {
  const query = new URLSearchParams({ clusterName, zone });
  const response = await fetch(`/api/gke/status?${query}`, {
    headers: getAuthHeaders(false),
  });
  if (!response.ok) throw new Error('Failed to fetch GKE status');
  return response.json();
};

export const deployGkeCluster = async (formData) => {
  const response = await fetch('/api/gke/deploy', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(formData),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'GKE deployment initialization failed');
  }
  return response.json();
};

export const deleteGkeCluster = async (clusterName) => {
  const response = await fetch(`/api/gke/delete/${clusterName}`, {
    method: 'DELETE',
    headers: getAuthHeaders(false),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'GKE cluster deletion failed');
  }
  return response.json();
};

export const syncGke = async () => {
  const response = await fetch('/api/gke/sync', {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'GKE synchronization failed');
  }
  return response.json();
};
