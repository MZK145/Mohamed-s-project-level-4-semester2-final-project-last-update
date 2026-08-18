/*
 * MetroSync synchronization fix.
 * Keeps the single stationsData source refreshed after every station mutation
 * and prevents the dashboard from showing a false "Error loading dashboard"
 * when a socket update arrives while an admin view is changing.
 */
(function () {
  const API_BASE_URL = window.BACKEND_URL || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5000'
      : window.location.origin
  );

  const authHeaders = () => {
    const token = localStorage.getItem('token