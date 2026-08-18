(function () {
  const API_BASE_URL = window.BACKEND_URL || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5000'
      : window.location.origin
  );

  function formatTime(value) {
    return value || 'N/A';
  }

  function getStationById(stations, id) {
    return stations.find((station) => String(station._id) === String(id));
  }

  function rememberDestinationId(stations) {
    if (window.__selectedDestinationStationId) return;
    if (typeof selectedDestination === 'undefined' || !selectedDestination) return;
    const station = stations.find((item) => item.name === selectedDestination);
    if (station) window.__selectedDestinationStationId = String(station._id);
  }

  function getSelectedDestinationStation(stations) {
    rememberDestinationId(stations);
    if (!window.__selectedDestinationStationId) return null;
    return getStationById(stations, window.__selectedDestinationStationId);
  }

  function updatePassengerRoom(stations) {
    if (typeof currentStationId === 'undefined' || !currentStationId) return;
    const waitingRoom = document.getElementById('waitingRoom');
    if (!waitingRoom || waitingRoom.style.display === 'none') return;

    const origin = getStationById(stations, currentStationId);
    if (!origin) return;

    const destination = getSelectedDestinationStation(stations);
    if (destination && typeof selectedDestination !== 'undefined') {
      selectedDestination = destination.name;
    }

    if (typeof selectedOrigin !== 'undefined') selectedOrigin = origin.name;
    if (typeof selectedOriginLine !== 'undefined') selectedOriginLine = origin.line;

    const journeyInfo = document.getElementById('journeyInfo');
    if (journeyInfo) {
      journeyInfo.innerHTML = `
        <strong>${escapeHtml(origin.name)}</strong> → <strong>${escapeHtml(destination?.name || selectedDestination || 'Destination')}</strong><br>
        Line: ${escapeHtml(origin.line || 'N/A')} &nbsp;|&nbsp; Order: ${Number(origin.order || 0)}
      `;
    }

    const waitingStatus = document.getElementById('waitingStatus');
    if (waitingStatus) {
      waitingStatus.innerHTML = `
        🚆 <strong>Arrival:</strong> ${escapeHtml(formatTime(origin.arrivalTime))} &nbsp;|&nbsp;
        <strong>Departure:</strong> ${escapeHtml(formatTime(origin.departureTime))}<br>
        <span style="color:#93c5fd;">✅ Schedule updated from the station record</span>
      `;
    }
  }

  function updateAdminRoom(stations) {
    if (!window.__adminRoomId) return;
    const station = getStationById(stations, window.__adminRoomId);
    if (!station) return;

    const container = document.getElementById('adminViewContainer');
    if (!container) return;

    const title = container.querySelector('h3');
    const description = container.querySelector('h3 + p');

    if (title) title.textContent = `👁️ ${station.name} Room`;
    if (description) description.textContent = 'Admin observer mode — not included in passenger counts.';

    let metadata = container.querySelector('#adminRoomMetadata');
    if (!metadata) {
      const presence = container.querySelector('#adminRoomPresence');
      metadata = document.createElement('div');
      metadata.id = 'adminRoomMetadata';
      metadata.style.cssText = 'padding:12px 14px;background:#0f172a;border:1px solid #334155;border-radius:12px;color:#cbd5e1;margin-bottom:14px;';
      if (presence) presence.insertAdjacentElement('beforebegin', metadata);
    }

    metadata.innerHTML = `
      <strong>${escapeHtml(station.name)}</strong><br>
      Line: ${escapeHtml(station.line || 'N/A')} &nbsp;|&nbsp;
      Order: ${Number(station.order || 0)} &nbsp;|&nbsp;
      Arrival: ${escapeHtml(formatTime(station.arrivalTime))} &nbsp;|&nbsp;
      Departure: ${escapeHtml(formatTime(station.departureTime))}
    `;
  }

  async function refreshLiveRoomData() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/stations`);
      if (!response.ok) return;
      const stations = await response.json();
      if (!Array.isArray(stations)) return;

      window.__liveRoomStations = stations;
      rememberDestinationId(stations);
      updatePassengerRoom(stations);
      updateAdminRoom(stations);

      if (typeof currentAdminView !== 'undefined' && currentAdminView === 'stations' && typeof loadAdminStations === 'function') {
        loadAdminStations();
      }
    } catch (error) {
      console.error('Live room refresh failed:', error);
    }
  }

  function attachSocketListener() {
    const socket = window.__metroSocket;
    if (!socket || socket.__liveRoomSyncAttached) return Boolean(socket);

    socket.__liveRoomSyncAttached = true;
    socket.on('stationsUpdated', refreshLiveRoomData);
    return true;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const checkSocket = setInterval(() => {
      if (attachSocketListener()) clearInterval(checkSocket);
    }, 250);
    setTimeout(() => clearInterval(checkSocket), 10000);

    setInterval(() => {
      const waitingRoom = document.getElementById('waitingRoom');
      if (waitingRoom && waitingRoom.style.display !== 'none') {
        rememberDestinationId(window.__liveRoomStations || []);
      }
    }, 1000);
  });

  window.refreshLiveRoomData = refreshLiveRoomData;
})();
