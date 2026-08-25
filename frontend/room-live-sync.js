/* MetroSync: keep an already-open waiting room synchronized with station edits. */
(function () {
  const API_BASE_URL = window.BACKEND_URL || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5000'
      : window.location.origin
  );

  let refreshTimer = null;
  let activeStationId = null;
  let lastSnapshot = '';
  let socketListenerAttached = false;

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function getActiveStationId() {
    if (typeof currentStationId !== 'undefined' && currentStationId) return String(currentStationId);
    if (typeof selectedOriginStationId !== 'undefined' && selectedOriginStationId) return String(selectedOriginStationId);
    return activeStationId;
  }

  function getStationFromLocalState(stationId) {
    const list = Array.isArray(window.__liveStations) ? window.__liveStations :
      (typeof stationsData !== 'undefined' && Array.isArray(stationsData) ? stationsData : []);
    return list.find((station) => String(station._id) === String(stationId)) || null;
  }

  async function fetchStation(stationId) {
    const response = await fetch(`${API_BASE_URL}/api/v1/stations/${encodeURIComponent(stationId)}?t=${Date.now()}`, {
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`Station refresh failed (${response.status})`);
    return response.json();
  }

  function parseTime(value) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''))) return null;
    const [hours, minutes] = String(value).split(':').map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(hours, minutes, 0, 0);
    if (target < now) target.setDate(target.getDate() + 1);
    return target;
  }

  function formatCountdown(arrivalTime) {
    const target = parseTime(arrivalTime);
    if (!target) return 'Arrival time not configured';
    const seconds = Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `Arrives in ${hours}h ${minutes}m`;
    return `Arrives in ${minutes}m ${secs.toString().padStart(2, '0')}s`;
  }

  function updateRoomDom(station) {
    if (!station) return;

    const journeyInfo = document.getElementById('journeyInfo');
    if (journeyInfo) {
      journeyInfo.innerHTML = `
        <div><strong>${escapeHtml(station.name || 'Station')}</strong></div>
        <div>${escapeHtml(station.line || 'Line')} · ${escapeHtml(station.city || '')}</div>
        <div>Arrival: <strong>${escapeHtml(station.arrivalTime || 'N/A')}</strong> &nbsp; Departure: <strong>${escapeHtml(station.departureTime || 'N/A')}</strong></div>
      `;
    }

    const waitingStatus = document.getElementById('waitingStatus');
    if (waitingStatus) {
      waitingStatus.textContent = `Live station: ${station.name || 'Station'} · ${station.line || 'Line'}`;
    }

    const countdown = document.getElementById('countdown');
    if (countdown) countdown.textContent = formatCountdown(station.arrivalTime);

    const trainStatus = document.getElementById('trainStatus');
    if (trainStatus) {
      trainStatus.textContent = `${station.name || 'Station'} · ${formatCountdown(station.arrivalTime)}`;
    }

    const roomName = document.getElementById('roomName');
    if (roomName) roomName.textContent = station.name || 'Station';

    const roomLine = document.getElementById('roomLine');
    if (roomLine) roomLine.textContent = `${station.line || 'Line'} · ${station.city || ''}`.trim();

    const roomArrival = document.getElementById('roomArrival');
    if (roomArrival) roomArrival.textContent = station.arrivalTime || '—';

    const roomStatusDetail = document.getElementById('roomStatusDetail');
    if (roomStatusDetail) {
      roomStatusDetail.textContent = `Arrival ${station.arrivalTime || 'N/A'} · Departure ${station.departureTime || 'N/A'}`;
    }

    const snapshot = JSON.stringify({
      name: station.name,
      line: station.line,
      arrivalTime: station.arrivalTime,
      departureTime: station.departureTime,
      order: station.order
    });

    if (snapshot !== lastSnapshot) {
      lastSnapshot = snapshot;
      if (typeof selectedOriginStationId !== 'undefined' && String(selectedOriginStationId) === String(station._id)) {
        if (typeof selectedOrigin !== 'undefined') selectedOrigin = station.name;
        if (typeof selectedOriginLine !== 'undefined') selectedOriginLine = station.line;
      }
    }
  }

  async function syncOpenRoom() {
    const roomVisible = document.getElementById('waitingRoom')?.style.display !== 'none';
    if (!roomVisible) return;

    const stationId = getActiveStationId();
    if (!stationId) return;
    activeStationId = String(stationId);

    try {
      const station = await fetchStation(activeStationId);
      updateRoomDom(station);
    } catch (error) {
      const fallback = getStationFromLocalState(activeStationId);
      if (fallback) updateRoomDom(fallback);
      console.warn('Waiting-room live sync failed:', error.message);
    }
  }

  function attachSocketListener() {
    if (socketListenerAttached) return;
    if (typeof socket === 'undefined' || !socket || typeof socket.on !== 'function') return;
    socket.on('stationsUpdated', () => {
      syncOpenRoom();
    });
    socketListenerAttached = true;
  }

  function startPolling() {
    if (refreshTimer) return;
    refreshTimer = setInterval(() => {
      attachSocketListener();
      syncOpenRoom();
    }, 2000);
  }

  function boot() {
    attachSocketListener();
    startPolling();
    syncOpenRoom();
  }

  window.syncOpenWaitingRoom = syncOpenRoom;
  boot();
})();
