// frontend/admin-enhancements.js
// Enhances the existing UI without removing the original passenger journey flow.
// Admin sockets are identified at registration time and are excluded from passenger counts.

(function () {
  const API_BASE_URL = window.BACKEND_URL || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5000'
      : window.location.origin
  );

  const originalIo = window.io;
  if (typeof originalIo === 'function') {
    window.io = function (...args) {
      const socket = originalIo(...args);
      const originalEmit = socket.emit.bind(socket);

      socket.emit = function (event, ...eventArgs) {
        if (event === 'register' && typeof eventArgs[0] === 'string') {
          eventArgs[0] = {
            userId: eventArgs[0],
            role: localStorage.getItem('role') === 'admin' ? 'admin' : 'user'
          };
        }
        return originalEmit(event, ...eventArgs);
      };

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

  function addPanelIdentity() {
    const metro = document.getElementById('metroSection');
    if (!metro || document.getElementById('panelIdentity')) return;

    const bar = document.createElement('div');
    bar.id = 'panelIdentity';
    bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 0 18px;padding:12px 16px;border:1px solid #334155;border-radius:12px;background:#0f172a;';
    bar.innerHTML = `
      <div>
        <div id="panelRoleTitle" style="font-weight:700;color:#f8fafc;">MetroSync</div>
        <div id="panelRoleSubtitle" style="font-size:13px;color:#94a3b8;">Live metro information</div>
      </div>
      <button id="metroLogoutBtn" type="button" style="border:1px solid #475569;background:#1e293b;color:#f8fafc;border-radius:8px;padding:8px 12px;cursor:pointer;">Logout</button>
    `;
    metro.insertBefore(bar, metro.firstChild);

    document.getElementById('metroLogoutBtn').addEventListener('click', () => {
      const socket = window.__metroSocket;
      if (socket) socket.disconnect();
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('userId');
      window.location.reload();
    });
  }

  function refreshIdentity() {
    const role = localStorage.getItem('role');
    const title = document.getElementById('panelRoleTitle');
    const subtitle = document.getElementById('panelRoleSubtitle');
    if (!title || !subtitle) return;

    if (role === 'admin') {
      title.textContent = '🛠️ Admin Control Center';
      subtitle.textContent = 'Monitor passenger rooms, announcements, stations, and live activity.';
    } else if (role === 'user') {
      title.textContent = '🚉 Passenger Panel';
      subtitle.textContent = 'Choose your route and join a station waiting room.';
    }
  }

  async function getWaitingRooms() {
    const response = await fetch(`${API_BASE_URL}/api/v1/users/waiting-rooms`, {
      headers: window.getAuthHeaders ? window.getAuthHeaders() : {
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not load waiting rooms');
    return data;
  }

  function roomCard(room) {
    const status = room.active ? 'ACTIVE' : 'EMPTY';
    const statusStyle = room.active
      ? 'background:#14532d;color:#bbf7d0;'
      : 'background:#1e293b;color:#94a3b8;';

    return `
      <div class="waiting-room-card" data-room-id="${escape(room.stationId)}" style="border:1px solid ${room.active ? '#16a34a' : '#334155'};border-radius:14px;padding:16px;background:#0b1220;display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
          <div>
            <div style="font-size:18px;font-weight:700;color:#f8fafc;">${escape(room.name)}</div>
            <div style="font-size:13px;color:#94a3b8;">${escape(room.line)} · ${escape(room.city || 'Unknown city')}</div>
          </div>
          <span style="${statusStyle}padding:4px 8px;border-radius:999px;font-size:11px;font-weight:700;">${status}</span>
        </div>
        <div style="font-size:14px;color:#cbd5e1;">👥 Waiting passengers: <strong style="color:#f8fafc;">${Number(room.onlinePassengers || 0)}</strong></div>
        <button type="button" class="enter-waiting-room" data-station-id="${escape(room.stationId)}" data-station-name="${escape(room.name)}" style="border:none;background:#2563eb;color:white;border-radius:8px;padding:10px 12px;cursor:pointer;font-weight:700;">Enter Room →</button>
      </div>
    `;
  }

  function wireRoomButtons() {
    document.querySelectorAll('.enter-waiting-room').forEach((button) => {
      button.addEventListener('click', () => {
        openAdminRoom(button.dataset.stationId, button.dataset.stationName);
      });
    });
  }

  async function renderWaitingRooms() {
    const container = document.getElementById('adminViewContainer');
    if (!container) return;

    container.innerHTML = '<div style="color:#94a3b8;padding:20px;text-align:center;">Loading waiting rooms...</div>';

    try {
      const data = await getWaitingRooms();
      const activeRooms = Number(data.activeRooms || 0);
      const totalRooms = Number(data.totalRooms || 0);

      container.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:16px;">
          <div>
            <h3 style="margin:0;color:#f8fafc;">🚉 Waiting Rooms</h3>
            <p style="margin:5px 0 0;color:#94a3b8;font-size:13px;">Choose any station room to monitor it without being counted as a passenger.</p>
          </div>
          <button id="refreshWaitingRooms" type="button" class="back-btn" style="padding:9px 14px;">↻ Refresh</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:18px;">
          <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:14px;">
            <div style="font-size:26px;font-weight:800;color:#22c55e;">${activeRooms}</div>
            <div style="color:#94a3b8;font-size:12px;">Active rooms</div>
          </div>
          <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:14px;">
            <div style="font-size:26px;font-weight:800;color:#60a5fa;">${totalRooms}</div>
            <div style="color:#94a3b8;font-size:12px;">Total rooms</div>
          </div>
        </div>
        <div id="waitingRoomsGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;">
          ${data.rooms.map(roomCard).join('')}
        </div>
      `;

      document.getElementById('refreshWaitingRooms').addEventListener('click', renderWaitingRooms);
      wireRoomButtons();
    } catch (error) {
      container.innerHTML = `<div style="color:#fca5a5;padding:15px;border:1px solid #7f1d1d;border-radius:10px;">${escape(error.message)}</div>`;
    }
  }

  async function loadRoomAnnouncements(stationId) {
    const response = await fetch(`${API_BASE_URL}/api/v1/${stationId}/announcements?limit=15`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not load room announcements');
    return Array.isArray(data.items) ? data.items : [];
  }

  async function openAdminRoom(stationId, stationName) {
    const container = document.getElementById('adminViewContainer');
    const socket = window.__metroSocket;
    if (!container || !socket) {
      alert('The real-time connection is not ready yet. Please refresh and try again.');
      return;
    }

    window.__adminRoomId = String(stationId);
    socket.emit('joinStation', String(stationId));

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
        <div>
          <h3 style="margin:0;color:#f8fafc;">👁️ ${escape(stationName)} Waiting Room</h3>
          <p style="margin:5px 0 0;color:#94a3b8;font-size:13px;">Admin monitoring mode — your account is excluded from the passenger count.</p>
        </div>
        <button id="backToWaitingRooms" type="button" class="back-btn" style="padding:9px 14px;">← All Rooms</button>
      </div>
      <div id="adminRoomPresence" style="padding:14px;border-radius:12px;background:#0f172a;border:1px solid #334155;color:#cbd5e1;margin-bottom:14px;">👥 Waiting passengers: <strong>0</strong></div>
      <div id="adminRoomAnnouncements" style="display:flex;flex-direction:column;gap:10px;"></div>
    `;

    document.getElementById('backToWaitingRooms').addEventListener('click', () => {
      socket.emit('leaveStation');
      window.__adminRoomId = null;
      renderWaitingRooms();
    });

    try {
      const announcements = await loadRoomAnnouncements(stationId);
      const list = document.getElementById('adminRoomAnnouncements');
      if (!announcements.length) {
        list.innerHTML = '<div style="color:#94a3b8;">No announcements in this room.</div>';
      } else {
        list.innerHTML = announcements.map((item) => `
          <div style="padding:12px;border:1px solid #334155;border-radius:10px;background:#111827;">
            <div style="font-weight:700;color:#f8fafc;">📢 ${escape(item.message)}</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:5px;">${escape(item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Recent')}</div>
          </div>
        `).join('');
      }
    } catch (error) {
      document.getElementById('adminRoomAnnouncements').innerHTML = `<div style="color:#fca5a5;">${escape(error.message)}</div>`;
    }

    const previousHandler = window.__adminPresenceHandler;
    if (previousHandler) socket.off('presenceUpdate', previousHandler);

    const updatePresence = ({ stationId: incomingId, count }) => {
      if (String(incomingId) !== String(stationId)) return;
      const target = document.getElementById('adminRoomPresence');
      if (target) target.innerHTML = `👥 Waiting passengers: <strong>${Number(count || 0)}</strong>`;
    };

    window.__adminPresenceHandler = updatePresence;
    socket.on('presenceUpdate', updatePresence);
    socket.emit('joinStation', String(stationId));
  }

  function addWaitingRoomsButton() {
    const nav = document.querySelector('#adminContent > div');
    if (!nav || document.getElementById('adminWaitingRoomsBtn')) return;

    const button = document.createElement('button');
    button.id = 'adminWaitingRoomsBtn';
    button.className = 'submit-btn';
    button.style.cssText = 'background:#10b981;padding:10px 20px;margin:0;';
    button.textContent = '🚉 Waiting Rooms';
    button.addEventListener('click', renderWaitingRooms);
    nav.appendChild(button);
  }

  const originalRender = window.renderAdminDashboard;
  if (typeof originalRender === 'function') {
    window.renderAdminDashboard = function () {
      originalRender();
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

  addPanelIdentity();
  refreshIdentity();
  setInterval(() => {
    addPanelIdentity();
    refreshIdentity();
    if (localStorage.getItem('role') !== 'admin') return;
    const online = document.getElementById('adminOnlineCountDisplay');
    if (online && window.__metroSocket?.connected) {
      const label = online.parentElement?.querySelector('div:last-child');
      if (label) label.textContent = '👥 Online Passengers';
    }
  }, 1000);

  setInterval(() => {
    const role = localStorage.getItem('role');
    if (role !== 'admin' || window.__adminRoomId) return;
    const grid = document.getElementById('waitingRoomsGrid');
    if (grid) renderWaitingRooms();
  }, 5000);
})();
