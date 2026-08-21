/* MetroSync: one canonical live-sync path for station changes. */
(function () {
  const API_BASE_URL = window.BACKEND_URL || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5000'
      : window.location.origin
  );

  let refreshInFlight = false;
  let originalShowAdminDashboard = null;
  let originalRefreshStationsData = null;

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

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
      if (typeof selectedOriginStationId !== 'undefined') selectedOriginStationId = restoredStation._id;
      if (typeof selectedOrigin !== 'undefined') selectedOrigin = restoredStation.name;
      if (typeof selectedOriginLine !== 'undefined') selectedOriginLine = restoredStation.line;
    }
  }

  // Replace the original refresh function with a single no-cache refresh that
  // also preserves the passenger's current selections. The main script's
  // stationsUpdated listener will call this function after every edit/add/delete.
  function installSafeStationRefresh() {
    if (originalRefreshStationsData || typeof window.refreshStationsData !== 'function') return;
    originalRefreshStationsData = window.refreshStationsData;

    window.refreshStationsData = async function () {
      const stations = await fetchStationsFresh();
      preservePassengerSelections(stations);
      return stations;
    };
  }

  function updateAdminRoomFromStations(stations) {
    if (!window.__adminRoomId) return;

    const station = stations.find(item => String(item._id) === String(window.__adminRoomId));
    const container = document.getElementById('adminViewContainer');
    if (!station || !container) return;

    const title = container.querySelector('h3');
    if (title) title.textContent = `👁️ ${station.name} Room`;

    const editButton = document.getElementById('editAdminRoomStation');
    if (editButton) {
      editButton.dataset.name = station.name;
      editButton.textContent = '✏️ Edit Station / Destination';
    }

    const metadata = container.querySelector('#adminRoomMetadata');
    if (metadata) {
      metadata.innerHTML = `
        <strong>${escapeHtml(station.name)}</strong><br>
        Line: ${escapeHtml(station.line || 'N/A')} &nbsp;|&nbsp;
        Governorate: ${escapeHtml(station.governorate || 'N/A')} &nbsp;|&nbsp;
        City: ${escapeHtml(station.city || 'N/A')}<br>
        Arrival: ${escapeHtml(station.arrivalTime || 'N/A')} &nbsp;|&nbsp;
        Departure: ${escapeHtml(station.departureTime || 'N/A')}
      `;
    }
  }

  async function syncAdminRoom(stations) {
    if (!window.__adminRoomId) return;
    updateAdminRoomFromStations(stations);

    const presence = document.getElementById('adminRoomPresence');
    const socket = window.__metroSocket;
    if (presence && socket?.connected) {
      socket.emit('joinStation', String(window.__adminRoomId));
    }
  }

  async function syncAfterStationUpdate() {
    if (refreshInFlight) return;
    refreshInFlight = true;

    try {
      const stations = await fetchStationsFresh();
      preservePassengerSelections(stations);

      // Never replace the active observer room with the dashboard after a
      // station edit. Update the room in place instead.
      if (window.__adminRoomId) {
        await syncAdminRoom(stations);
        return;
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

  function installSafeDashboard() {
    if (originalShowAdminDashboard || typeof window.showAdminDashboard !== 'function') return;
    originalShowAdminDashboard = window.showAdminDashboard;

    window.showAdminDashboard = async function () {
      const container = document.getElementById('adminViewContainer');
      if (!container) return;

      // An admin may be observing a room while another station is edited.
      // Keep that room open rather than replacing it with the dashboard.
      if (window.__adminRoomId) return;

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
          await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
        }
      }

      if (previousHtml) container.innerHTML = previousHtml;
    };
  }

  window.updateAdminRoomFromStations = updateAdminRoomFromStations;
  window.syncMetroStations = syncAfterStationUpdate;

  function attach() {
    installSafeDashboard();
    installSafeStationRefresh();

    // The main script already listens for stationsUpdated. We intentionally do
    // not register a second listener here because competing refresh callbacks
    // caused dashboard/room race conditions after edits.
  }

  attach();
  const timer = setInterval(attach, 200);
  setTimeout(() => clearInterval(timer), 15000);
})();
