(function () {
  const API_BASE_URL = window.BACKEND_URL || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5000'
      : window.location.origin
  );

  function formatTime(value) {
    if (!value) return 'N/A';
    return value;
  }

  function getStationById(stations, id) {
    return stations.find((station) => String(station._id) === String(id));
  }

  function getSelectedDestinationStation(stations) {
    if (window.__selectedDestinationStationId) {
      return getStationById(stations, window.__selectedDestinationStationId);
    }

    if (typeof selectedDestination !== 'undefined' && selectedDestination) {
      const station = stations.find((item) => item.name === selectedDestination);
      if (station) window.__selectedDestinationStationId = String(station._id);
      return station;
    }

    return null;
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

  async function refreshLiveRoomData() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/stations`);
      if (!response.ok) return;
      const stations = await response.json();
      if (!Array.isArray(stations)) return;

      window.__liveRoomStations = stations;
      updatePassengerRoom(stations);

      if (window.__adminRoomId) {
        const station = getStationById(stations, window.__adminRoomId);
        const title = document.getElementById('adminRoomTitle');
        const meta = document.getElementById('adminRoomMeta');
        if (station) {
          if (title) title.textContent = `👁️ ${station.name} Room`;
          if (meta) {
            meta.textContent = `${station.line || 'N/A'} · Order ${Number(station.order || 0)} · Arrival ${formatTime(station.arrivalTime)} · Departure ${formatTime(station.departureTime)}`;
          }
        }
      }

      if (typeof currentAdminView !== 'undefined' && currentAdminView === 'stations' && typeof loadAdminStations === 'function') {
        loadAdminStations();
      }
    } catch (error) {
      console.error('Live room refresh failed:', error);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('stationsUpdated', refreshLiveRoomData);
    if (window.io && typeof window.io === 'function') {
      const checkSocket = setInterval(() => {
        const socket = window.__metroSocket;
        if (!socket) return;
        clearInterval(checkSocket);
        socket.on('stationsUpdated', refreshLiveRoomData);
      }, 250);
      setTimeout(() => clearInterval(checkSocket), 10000);
    }
  });

  window.refreshLiveRoomData = refreshLiveRoomData;
})();
