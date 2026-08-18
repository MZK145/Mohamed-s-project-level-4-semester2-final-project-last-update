/* MetroSync: centralize live station refreshes and keep the current admin view stable. */
(function () {
  const API_BASE_URL = window.BACKEND_URL || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5000'
      : window.location.origin
  );

  let refreshTimer = null;
  let refreshInFlight = false;

  async function fetchStationsFresh() {
    const response = await fetch(`${API_BASE_URL}/api/v1/stations`, {
      headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
    });
    if (!response.ok) throw new Error(`Station refresh failed (${response.status})`);
    const stations = await response.json();
    if (!Array.isArray(stations)) throw new Error('Invalid stations response');
    window.__liveStations = stations;
    if (Array.isArray(window.stationsData)) window.stationsData = stations;
    return stations;
  }

  async function syncAfterStationUpdate() {
    if (refreshInFlight) return;
    refreshInFlight = true;
    try {
      const stations = await fetchStationsFresh();

      if (typeof populateDropdownsFromStations === 'function') {
        // Preserve the shared data used by passenger and admin views.
        stationsData = stations;
      }

      if (window.__adminRoomId && typeof updateAdminRoomFromStations === 'function') {
        updateAdminRoomFromStations(stations);
      }

      if (window.__adminRoomId && typeof window.refreshLiveRoomData === 'function') {
        await window.refreshLiveRoomData();
        return;
      }

      if (typeof currentAdminView !== 'undefined' && currentAdminView === 'stations' && typeof loadAdminStations === 'function') {
        await loadAdminStations();
      } else if (typeof currentAdminView !== 'undefined' && currentAdminView === 'dashboard' && typeof showAdminDashboard === 'function') {
        await showAdminDashboard();
      }
    } catch (error) {
      // Do not replace a working admin room/dashboard with a generic error
      // merely because an asynchronous socket refresh failed.
      console.error('Station synchronization failed:', error);
    } finally {
      refreshInFlight = false;
    }
  }

  function scheduleSync() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(syncAfterStationUpdate, 120);
  }

  function updateAdminRoomFromStations(stations) {
    if (!window.__adminRoomId) return;
    const station = stations.find(s => String(s._id) === String(window.__adminRoomId));
    if (!station) return;
    const container = document.getElementById('adminViewContainer');
    if (!container) return;
    const title = container.querySelector('h3');
    if (title) title.textContent = `👁️ ${station.name} Room`;
  }

  window.updateAdminRoomFromStations = updateAdminRoomFromStations;
  window.syncMetroStations = syncAfterStationUpdate;

  function attach() {
    const socket = window.__metroSocket;
    if (!socket || socket.__fixSyncAttached) return;
    socket.__fixSyncAttached = true;
    socket.on('stationsUpdated', scheduleSync);
  }

  const timer = setInterval(attach, 200);
  setTimeout(() => clearInterval(timer), 15000);
  attach();
})();
