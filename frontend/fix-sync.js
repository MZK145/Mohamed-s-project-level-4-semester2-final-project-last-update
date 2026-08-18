/* MetroSync: one safe live-sync path for station changes. */
(function () {
  const API_BASE_URL = window.BACKEND_URL || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5000'
      : window.location.origin
  );

  let refreshTimer = null;
  let refreshInFlight = false;
  let originalShowAdminDashboard = null;

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  async function fetchStationsFresh() {
    const response = await fetch(`${API_BASE_URL}/api/v1/stations`, {
      cache: 'no-store',
      headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}
    });

    if (!response.ok) throw new Error(`Station refresh failed (${response.status})`);

    const stations = await response.json();
    if (!Array.isArray(stations)) throw new Error('Invalid stations response');

    window.__liveStations = stations;
    stationsData = stations;
    return stations;
  }

  function preservePassengerSelections(stations) {
    const governorate = document.getElementById('governorate');
    const city = document.getElementById('city');
    const station = document.getElementById('stations');

    if (!governorate || !city || !station || typeof populateDropdownsFromStations !== 'function') return;

    const oldGovernorate = governorate.value;
    const oldCity = city.value;
    const oldStationName = station.value;
    const oldStationId = typeof selectedOriginStationId !== 'undefined' ? selectedOriginStationId : null;

    populateDropdownsFromStations(stations);

    if (oldGovernorate && stations.some(item => item.governorate === oldGovernorate)) {
      governorate.value = oldGovernorate;
      if (typeof populateCities === 'function') populateCities();
    }

    if (oldCity && [...city.options].some(option => option.value === oldCity)) {
      city.value = oldCity;
      if (typeof populateStations === 'function') populateStations();
    }

    const restoredStation = oldStationId
      ? stations.find(item => String(item._id) === String(oldStationId))
      : stations.find(item => item.name === oldStationName);

    if (restoredStation && [...station.options].some(option => option.value === restoredStation.name)) {
      station.value = restoredStation.name;
    }
  }

  async function syncAfterStationUpdate() {
    if (refreshInFlight) return;
    refreshInFlight = true;

    try {
      const stations = await fetchStationsFresh();
      preservePassengerSelections(stations);

      if (window.__adminRoomId && typeof window.refreshLiveRoomData === 'function') {
        await window.refreshLiveRoomData();
      }

      if (typeof currentAdminView !== 'undefined' && currentAdminView === 'stations' && typeof loadAdminStations === 'function') {
        await loadAdminStations();
      } else if (typeof currentAdminView !== 'undefined' && currentAdminView === 'dashboard' && typeof window.showAdminDashboard === 'function') {
        await window.showAdminDashboard();
      }
    } catch (error) {
      console.error('Station synchronization failed:', error);
    } finally {
      refreshInFlight = false;
    }
  }

  function scheduleSync() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(syncAfterStationUpdate, 150);
  }

  function updateAdminRoomFromStations(stations) {
    if (!window.__adminRoomId) return;
    const station = stations.find(item => String(item._id) === String(window.__adminRoomId));
    const container = document.getElementById('adminViewContainer');
    if (!station || !container) return;

    const title = container.querySelector('h3');
    if (title) title.textContent = `👁️ ${station.name} Room`;

    const metadata = container.querySelector('#adminRoomMetadata');
    if (metadata) {
      metadata.innerHTML = `
        <strong>${escapeHtml(station.name)}</strong><br>
        Line: ${escapeHtml(station.line || 'N/A')} &nbsp;|&nbsp;
        Order: ${Number(station.order || 0)} &nbsp;|&nbsp;
        Arrival: ${escapeHtml(station.arrivalTime || 'N/A')} &nbsp;|&nbsp;
        Departure: ${escapeHtml(station.departureTime || 'N/A')}
      `;
    }
  }

  function installSafeDashboard() {
    if (originalShowAdminDashboard || typeof window.showAdminDashboard !== 'function') return;
    originalShowAdminDashboard = window.showAdminDashboard;

    window.showAdminDashboard = async function () {
      const container = document.getElementById('adminViewContainer');
      if (!container) return;

      const previousHtml = container.innerHTML;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await originalShowAdminDashboard();
          const text = container.textContent || '';
          if (!text.includes('Error loading dashboard.')) return;
        } catch (error) {
          console.error('Dashboard refresh failed:', error);
        }

        if (attempt < 2) {
          container.innerHTML = previousHtml;
          await sleep(250 * (attempt + 1));
        }
      }

      if (previousHtml) container.innerHTML = previousHtml;
    };
  }

  window.updateAdminRoomFromStations = updateAdminRoomFromStations;
  window.syncMetroStations = syncAfterStationUpdate;

  function attach() {
    installSafeDashboard();

    const socket = window.__metroSocket;
    if (!socket || socket.__fixSyncAttached) return;

    socket.__fixSyncAttached = true;
    socket.__liveRoomSyncAttached = true;
    socket.on('stationsUpdated', scheduleSync);
  }

  const timer = setInterval(attach, 200);
  setTimeout(() => clearInterval(timer), 15000);
  attach();
})();
