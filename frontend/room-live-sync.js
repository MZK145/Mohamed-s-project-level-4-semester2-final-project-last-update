/* MetroSync: station updates are coordinated by fix-sync.js. */
(function () {
  function attach() {
    const socket = window.__metroSocket;
    if (!socket || socket.__roomLiveSyncDelegated) return;

    socket.__roomLiveSyncDelegated = true;

    socket.on('stationsUpdated', () => {
      if (typeof window.syncMetroStations === 'function') {
        window.syncMetroStations();
      }
    });
  }

  const timer = setInterval(attach, 200);
  setTimeout(() => clearInterval(timer), 15000);
  attach();
})();
