(function () {
  const API_BASE_URL = window.BACKEND_URL || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5000'
      : window.location.origin
  );

  const originalIo = window.io;
  if (typeof originalIo === 'function') {
    window.io = function (...args) {
      const options = args[1] && typeof args[1] === 'object' ? { ...args[1] } : {};
      const token = localStorage.getItem('token');
      if (token) options.auth = { ...(options.auth || {}), token };
      args[1] = options;

      const socket = originalIo(...args);
      window.__metroSocket = socket;
      return socket;
    };
  }

  function escape(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function addIdentityBar() {
    const metro = document.getElementById('metroSection');
    if (!metro || document.getElementById('panelIdentity')) return;

    const bar = document.createElement('div');
    bar.id = 'panelIdentity';
    bar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px;margin:8px 0 18px;padding:14px 16px;background:#0f172a;border:1px solid #334155;border-radius:12px;';
    bar.innerHTML = `
      <div>
        <div id="panelRoleTitle" style="font-weight:800;color:#f8fafc;">MetroSync</div>
        <div id="panelRoleSubtitle" style="color:#94a3b8;font-size:13px;">Live metro information</div>
      </div>
      <button id="metroLogoutBtn" type="button" style="border:1px solid #475569;background:#1e293b;color:#f8fafc;border-radius:8px;padding:8px 12px;cursor:pointer;">Logout</button>
    `;
    metro.insertBefore(bar, metro.firstChild);

    document.getElementById('metroLogoutBtn').addEventListener('click', () => {
      window.__metroSocket?.disconnect();
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('userId');
      window.location.reload();
    });
  }

  function updateIdentityBar() {
    const role = localStorage.getItem('role');
    const title = document.getElementById('panelRoleTitle');
    const subtitle = document.getElementById('panelRoleSubtitle');
    if (!title || !subtitle) return;

    if (role === 'admin') {
      title.textContent = '🛠️ Admin Control Center';
      subtitle.textContent = 'Monitor waiting rooms, live passengers, announcements, and stations.';
    } else if (role === 'user') {
      title.textContent = '🚉 Passenger Panel';
      subtitle.textContent = 'Choose a route and follow your station waiting room in real time.';
    }
  }

  async function fetchWaitingRooms() {
    const response = await fetch(`${API_BASE_URL}/api/v1/users/waiting-rooms`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not load waiting rooms');
    return data;
  }

  function addWaitingRoomsButton() {
    const nav = document.querySelector('#adminContent > div');
    if (!nav || document.getElementById('adminWaitingRoomsBtn')) return;

    const button = document.createElement('button');
    button.id = 'adminWaitingRoomsBtn';
    button.className = 'submit-btn';
    button.style.cssText = 'background:#10b981;padding:10px 20px;margin:0;';
    button.textContent = '🚉 Waiting Rooms';
    button.addEventListener('click', showWaitingRooms);
    nav.appendChild(button);
  }

  async function showWaitingRooms() {
    const container = document.getElementById('adminViewContainer');
    if (!container) return;
    container.innerHTML = '<div style="padding:20px;color:#94a3b8;text-align:center;">Loading waiting rooms...</div>';

    try {
      const data = await fetchWaitingRooms();
      container.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:16px;">
          <div>
            <h3 style="margin:0;color:#f8fafc;">🚉 All Waiting Rooms</h3>
            <p style="margin:5px 0 0;color:#94a3b8;font-size:13px;">Admin monitoring does not increase passenger counts.</p>
          </div>
          <button id="refreshWaitingRooms" type="button" class="back-btn">↻ Refresh</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:18px;">
          <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:14px;"><strong style="font-size:26px;color:#22c55e;">${Number(data.activeRooms || 0)}</strong><div style="color:#94a3b8;font-size:12px;">Active rooms</div></div>
          <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:14px;"><strong style="font-size:26px;color:#60a5fa;">${Number(data.totalRooms || 0)}</strong><div style="color:#94a3b8;font-size:12px;">Total rooms</div></div>
        </div>
        <div id="waitingRoomsGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:14px;">
          ${data.rooms.map((room) => `
            <div style="border:1px solid ${room.active ? '#16a34a' : '#334155'};border-radius:14px;padding:15px;background:#0b1220;">
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:start;">
                <div><div style="font-size:18px;font-weight:800;color:#f8fafc;">${escape(room.name)}</div><div style="color:#94a3b8;font-size:13px;">${escape(room.line)} · ${escape(room.city || 'Unknown')}</div></div>
                <span style="font-size:11px;font-weight:700;padding:4px 8px;border-radius:999px;background:${room.active ? '#14532d' : '#1e293b'};color:${room.active ? '#bbf7d0' : '#94a3b8'};">${room.active ? 'ACTIVE' : 'EMPTY'}</span>
              </div>
              <div style="margin:14px 0;color:#cbd5e1;">👥 Waiting passengers: <strong>${Number(room.onlinePassengers || 0)}</strong></div>
              <button type="button" class="enter-waiting-room" data-id="${escape(room.stationId)}" data-name="${escape(room.name)}" style="width:100%;border:0;background:#2563eb;color:#fff;border-radius:8px;padding:10px;cursor:pointer;font-weight:700;">Enter Room →</button>
            </div>
          `).join('')}
        </div>
      `;

      document.getElementById('refreshWaitingRooms').addEventListener('click', showWaitingRooms);
      container.querySelectorAll('.enter-waiting-room').forEach((button) => {
        button.addEventListener('click', () => openAdminRoom(button.dataset.id, button.dataset.name));
      });
    } catch (error) {
      container.innerHTML = `<div style="padding:15px;border:1px solid #7f1d1d;border-radius:10px;color:#fca5a5;">${escape(error.message)}</div>`;
    }
  }

  async function openAdminRoom(stationId, stationName) {
    const socket = window.__metroSocket;
    const container = document.getElementById('adminViewContainer');
    if (!socket || !container) return;

    window.__adminRoomId = String(stationId);
    socket.emit('joinStation', String(stationId));

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
        <div><h3 style="margin:0;color:#f8fafc;">👁️ ${escape(stationName)} Room</h3><p style="margin:5px 0 0;color:#94a3b8;font-size:13px;">Admin observer mode — not included in passenger counts.</p></div>
        <button id="backToRooms" type="button" class="back-btn">← All Rooms</button>
      </div>
      <div id="adminRoomPresence" style="padding:14px;background:#0f172a;border:1px solid #334155;border-radius:12px;color:#cbd5e1;margin-bottom:14px;">👥 Waiting passengers: <strong>0</strong></div>
      <div id="adminRoomAnnouncements" style="display:flex;flex-direction:column;gap:10px;"></div>
    `;

    const previousHandler = window.__adminPresenceHandler;
    if (previousHandler) socket.off('presenceUpdate', previousHandler);

    const presenceHandler = ({ stationId: incomingId, count }) => {
      if (String(incomingId) !== String(stationId)) return;
      const target = document.getElementById('adminRoomPresence');
      if (target) target.innerHTML = `👥 Waiting passengers: <strong>${Number(count || 0)}</strong>`;
    };
    window.__adminPresenceHandler = presenceHandler;
    socket.on('presenceUpdate', presenceHandler);

    document.getElementById('backToRooms').addEventListener('click', () => {
      socket.emit('leaveStation');
      window.__adminRoomId = null;
      showWaitingRooms();
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/${stationId}/announcements?limit=15`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load announcements');
      const announcements = Array.isArray(data.items) ? data.items : [];
      const box = document.getElementById('adminRoomAnnouncements');
      box.innerHTML = announcements.length
        ? announcements.map((item) => `<div style="padding:12px;background:#111827;border:1px solid #334155;border-radius:10px;"><strong style="color:#f8fafc;">📢 ${escape(item.message)}</strong><div style="color:#94a3b8;font-size:12px;margin-top:5px;">${escape(item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Recent')}</div></div>`).join('')
        : '<div style="color:#94a3b8;">No announcements in this room.</div>';
    } catch (error) {
      document.getElementById('adminRoomAnnouncements').innerHTML = `<div style="color:#fca5a5;">${escape(error.message)}</div>`;
    }

    socket.emit('joinStation', String(stationId));
  }

  const originalRenderAdmin = window.renderAdminDashboard;
  if (typeof originalRenderAdmin === 'function') {
    window.renderAdminDashboard = function () {
      originalRenderAdmin();
      setTimeout(addWaitingRoomsButton, 0);
    };
  }

  const originalShowDashboard = window.showAdminDashboard;
  if (typeof originalShowDashboard === 'function') {
    window.showAdminDashboard = async function () {
      await originalShowDashboard();
      addWaitingRoomsButton();
    };
  }

  addIdentityBar();
  updateIdentityBar();
  setInterval(() => {
    addIdentityBar();
    updateIdentityBar();
  }, 1000);
})();
