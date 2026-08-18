/* MetroSync: live station synchronization is handled by fix-sync.js. */
(function () {
  // Kept as a compatibility file because index.html loads it.
  // Do not register another stationsUpdated listener here: duplicate listeners
  // caused competing dashboard refreshes after station/room edits.
  window.__metroRoomLiveSyncReady = true;
})();
