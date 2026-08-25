/* MetroSync: reliable passenger station-room presence.
 *
 * The backend counts only JWT role=user sockets inside a station room. This
 * client-side recovery path makes sure a passenger joins that room even when
 * the socket connects after the journey UI has already moved to the waiting
 * room (a common race when an admin socket was connected first).
 */
(function () {
  const API_BASE_URL = window.BACKEND_URL || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5000'
      : window.location.origin
  );

  let lastJoinedStationId = null;
  let inFlight = false;

  function isPassenger() {
    return localStorage.getItem('role') === 'user' && Boolean(localStorage.getItem('token'));
  }

  function waitingRoomIsOpen() {
    const room = document.getElementById('waitingRoom');
    if (!room) return false;
    const style = window.getComputedStyle(room);
    return style.display !== 'none' && !room.hidden;
  }

  function selectedStationName() {
    const select = document.getElementById('stations');
    return select?.value?.trim() || '';
  }

  async function findSelectedStation() {
    const name = selectedStationName();
    if (!name) return null;

    const response = await fetch(`${API_BASE_URL}/api/v1/stations`, {
      cache: 'no-store'
    });
    if (!response.ok) return null;

    const stations = await response.json();
    if (!Array.isArray(stations)) return null;

    return stations.find((station) => String(station.name).trim() === name) || null;
  }

  async function ensurePassengerRoom() {
    if (!isPassenger() || !waitingRoomIsOpen()) return;

    const socket = window.__metroSocket;
    if (!socket || !socket.connected) return;
    if (inFlight) return;

    inFlight = true;
    try {
      const station = await findSelectedStation();
      if (!station?._id) return;

      const stationId = String(station._id);
      socket.emit('joinStation', stationId);
      lastJoinedStationId = stationId;
    } catch (error) {
      console.debug('Passenger presence recovery waiting for API/socket:', error?.message || error);
    } finally {
      inFlight = false;
    }
  }

  function attachSocket(socket) {
    if (!socket || socket.__presenceFixAttached) return;
    socket.__presenceFixAttached = true;

    socket.on('connect', () => {
      lastJoinedStationId = null;
      setTimeout(ensurePassengerRoom, 50);
    });

    socket.on('disconnect', () => {
      lastJoinedStationId = null;
    });
  }

  function attach() {
    attachSocket(window.__metroSocket);
    ensurePassengerRoom();
  }

  attach();
  const timer = setInterval(attach, 1000);
  window.addEventListener('beforeunload', () => clearInterval(timer));
})();
