/* Keep MetroSync's existing UI/style while aligning the runtime workflow with the stable MetroFlow behavior. */
(function () {
  const apiBase = window.BACKEND_URL || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5000'
      : window.location.origin
  );

  // The existing passenger script used /api/v1/:stationId/announcements,
  // while the backend route is mounted at /api/v1/stations/:stationId/announcements.
  // Rewrite only that legacy shape; leave every other request untouched.
  const originalFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    let url = typeof input === 'string' ? input : input?.url;
    if (url) {
      try {
        const parsed = new URL(url, window.location.origin);
        const prefix = new URL(apiBase, window.location.origin).origin;
        if (parsed.origin === prefix) {
          const match = parsed.pathname.match(/^\/api\/v1\/([^/]+)\/announcements$/);
          if (match && match[1] !== 'stations' && match[1] !== 'users' && match[1] !== 'auth') {
            parsed.pathname = `/api/v1/stations/${match[1]}/announcements`;
            if (typeof input === 'string') input = parsed.toString();
            else input = new Request(parsed.toString(), input);
          }
        }
      } catch (_) {
        // Preserve the original request on malformed/non-URL inputs.
      }
    }
    return originalFetch(input, init);
  };

  // Ensure Socket.IO always receives the current JWT without changing the page UI.
  const originalIo = window.io;
  if (typeof originalIo === 'function') {
    window.io = function (...args) {
      const callArgs = [...args];
      const options = callArgs[1] && typeof callArgs[1] === 'object' ? { ...callArgs[1] } : {};
      const token = localStorage.getItem('token');
      if (token) options.auth = { ...(options.auth || {}), token };
      callArgs[1] = options;
      const socket = originalIo(...callArgs);
      window.__metroSocket = socket;
      attachSocketWorkflow(socket);
      return socket;
    };
  }

  function attachSocketWorkflow(socket) {
    if (!socket || socket.__workflowCompatAttached) return;
    socket.__workflowCompatAttached = true;

    let activeStationId = null;
    const originalEmit = socket.emit.bind(socket);

    socket.emit = function (event, ...args) {
      if (event === 'joinStation' && args[0]) activeStationId = String(args[0]);
      if (event === 'leaveStation') activeStationId = null;
      return originalEmit(event, ...args);
    };

    socket.on('connect', () => {
      if (activeStationId) originalEmit('joinStation', activeStationId);
    });

    window.__metroSocketWorkflow = {
      getStationId: () => activeStationId,
      leave: () => {
        activeStationId = null;
        originalEmit('leaveStation');
      }
    };
  }
})();
