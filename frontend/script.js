// ========== CONFIGURATION ==========
// For local development the backend runs on port 5000. For deployment, define
// window.BACKEND_URL before this file is loaded (for example, your Render API URL).
const API_BASE_URL = window.BACKEND_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : window.location.origin
);

// ========== TOGGLE LOGIN / SIGNUP ==========
document.getElementById("showSignup").addEventListener("click", (event) => {
  event.preventDefault();
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("signupForm").style.display = "block";
  clearResult();
});

document.getElementById("showLogin").addEventListener("click", (event) => {
  event.preventDefault();
  document.getElementById("signupForm").style.display = "none";
  document.getElementById("loginForm").style.display = "block";
  clearResult();
});

function setResult(text, type) {
  const el = document.getElementById("loginResult");
  el.innerText = text;
  el.className = type;
}

function clearResult() {
  document.getElementById("loginResult").innerText = "";
  document.getElementById("loginResult").className = "";
}

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT format');
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch (error) {
    console.error('❌ Could not decode login token:', error);
    return null;
  }
}

// ========== SOCKET.IO ==========
let socket = null;
let currentUserId = null;
let currentStationId = null;

function setOnlineCount(count) {
  const value = Number.isFinite(Number(count)) ? String(count) : '0';
  const display = document.getElementById('onlineCountDisplay');
  if (display) display.textContent = value;

  const adminDisplay = document.getElementById('adminOnlineCountDisplay');
  if (adminDisplay) adminDisplay.textContent = value;
}

function setStationPresence(count) {
  const display = document.getElementById('stationPresenceCount');
  if (display) display.textContent = Number.isFinite(Number(count)) ? String(count) : '0';
}

function connectSocket(userId) {
  if (!userId) {
    console.error('❌ Cannot connect Socket.IO: user id is missing');
    return;
  }

  currentUserId = String(userId);

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socket = io(API_BASE_URL, {
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    timeout: 10000
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket.id);
    console.log('👤 Registering user:', currentUserId);
    socket.emit('register', currentUserId);

    // Socket.IO can reconnect after a network interruption. Re-join the
    // station room after every new connection.
    if (currentStationId) {
      socket.emit('joinStation', currentStationId);
    }
  });

  socket.on('registered', ({ userId: registeredId }) => {
    console.log('✅ Socket registration confirmed:', registeredId);
  });

  socket.on('registerError', (error) => {
    console.error('❌ Socket registration failed:', error);
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Socket connection error:', error.message || error);
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason);
  });

  socket.on('onlineCount', (count) => {
    console.log('📊 Online users:', count);
    setOnlineCount(count);
  });

  // ODF Task 6: station-room presence is scoped to the station being viewed.
  socket.on('presenceUpdate', ({ stationId, count }) => {
    if (String(stationId) === String(currentStationId)) {
      console.log(`👥 Station ${stationId} viewers:`, count);
      setStationPresence(count);
    }
  });

  socket.on('stationError', (error) => {
    console.error('❌ Station room error:', error);
  });

  // ODF Task 6: announcements are broadcast only to the station room.
  socket.on('announcement', (announcement) => {
    console.log('📢 New station announcement:', announcement);
    showAnnouncement(announcement);
  });

  socket.on('stationsUpdated', async () => {
    console.log('🔄 Stations updated, refreshing...');
    await refreshStationsData();
    if (currentAdminView === 'stations') loadAdminStations();
    else if (currentAdminView === 'dashboard') showAdminDashboard();
  });
}

function joinStationRoom(stationId) {
  if (!socket || !socket.connected || !stationId) return;
  currentStationId = String(stationId);
  socket.emit('joinStation', currentStationId);
  setStationPresence(0);
  loadStationAnnouncements(currentStationId);
}

function leaveStationRoom() {
  if (socket && socket.connected && currentStationId) {
    socket.emit('leaveStation');
  }
  currentStationId = null;
  setStationPresence(0);
}

function showAnnouncement(announcement) {
  const container = document.getElementById('stationAnnouncements');
  if (!container) return;

  const item = document.createElement('div');
  item.className = 'announcement-item';
  const date = announcement.createdAt ? new Date(announcement.createdAt).toLocaleString() : 'Just now';
  item.innerHTML = `<strong>📢 ${escapeHtml(announcement.message)}</strong><br><small>${escapeHtml(date)}</small>`;
  container.prepend(item);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function loadStationAnnouncements(stationId) {
  const container = document.getElementById('stationAnnouncements');
  if (!container || !stationId) return;
  container.innerHTML = '<div style="color:#94a3b8;">Loading announcements...</div>';

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/${stationId}/announcements?limit=10`);
    if (!res.ok) throw new Error('Failed to load announcements');
    const data = await res.json();
    const announcements = Array.isArray(data.items) ? data.items : [];
    container.innerHTML = '';

    if (announcements.length === 0) {
      container.innerHTML = '<div style="color:#94a3b8;">No announcements for this station.</div>';
      return;
    }

    announcements.forEach(showAnnouncement);
  } catch (error) {
    console.error('Announcement load error:', error);
    container.innerHTML = '<div style="color:#fca5a5;">Could not load announcements.</div>';
  }
}

// ========== SIGNUP ==========
document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;

  if (!name || !email || !password) {
    setResult("❌ All fields are required", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (res.ok) {
      setResult("✅ Account created successfully! Please log in.", "success");
      document.getElementById("signupForm").style.display = "none";
      document.getElementById("loginForm").style.display = "block";
      document.getElementById("signupForm").reset();
    } else {
      setResult("❌ " + (data.error || data.message || "Signup failed"), "error");
    }
  } catch (err) {
    console.error(err);
    setResult("❌ Server error. Please try again.", "error");
  }
});

// ========== LOGIN ==========
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    setResult("❌ Email and password are required", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setResult("❌ " + (data.error || "Invalid credentials"), "error");
      return;
    }

    const payload = decodeJwtPayload(data.token);
    const userId = payload?.id;
    if (!userId) throw new Error('Login token does not contain a user id');

    localStorage.setItem("token", data.token);
    localStorage.setItem("role", data.role);
    localStorage.setItem("userId", String(userId));

    connectSocket(userId);

    document.getElementById("metroSection").style.display = "block";
    document.getElementById("loginForm").style.display = "none";
    document.getElementById("loginForm").reset();
    clearResult();
    setOnlineCount(0);

    await loadStationsFromMetadata();

    if (data.role === 'admin') {
      document.getElementById('adminPanel').style.display = 'block';
      document.getElementById('originPanel').style.display = 'none';
      document.getElementById('destinationPanel').style.display = 'none';
      document.getElementById('trainSelectionPanel').style.display = 'none';
      document.getElementById('waitingRoom').style.display = 'none';
      renderAdminDashboard();
    } else {
      document.getElementById('adminPanel').style.display = 'none';
      document.getElementById('originPanel').style.display = 'block';
    }
  } catch (err) {
    console.error('Login error:', err);
    setResult("❌ " + (err.message || "Server error. Please try again."), "error");
  }
});

// ========== STATIONS MANAGEMENT ==========
let stationsData = [];
let currentAdminView = 'dashboard';

async function fetchStations() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/stations`);
    if (!res.ok) throw new Error('Failed to fetch stations');
    const stations = await res.json();
    stationsData = Array.isArray(stations) ? stations : [];
    return stationsData;
  } catch (err) {
    console.error('Error fetching stations:', err);
    stationsData = [];
    return [];
  }
}

async function refreshStationsData() {
  await fetchStations();
  populateDropdownsFromStations(stationsData);
}

function populateDropdownsFromStations(stations) {
  const govDropdown = document.getElementById('governorate');
  const governorates = [...new Set(stations.map(s => s.governorate).filter(Boolean))].sort();
  govDropdown.innerHTML = '<option value="">-- Select Governorate --</option>';
  governorates.forEach(gov => {
    const opt = document.createElement('option');
    opt.value = gov;
    opt.textContent = gov;
    govDropdown.appendChild(opt);
  });
  document.getElementById('city').innerHTML = '<option value="">-- Select City --</option>';
  document.getElementById('city').disabled = true;
  document.getElementById('stations').innerHTML = '<option value="">-- Select Station --</option>';
  document.getElementById('stations').disabled = true;
}

function populateCities() {
  const gov = document.getElementById('governorate').value;
  const cityDropdown = document.getElementById('city');
  cityDropdown.innerHTML = '<option value="">-- Select City --</option>';
  cityDropdown.disabled = !gov;

  if (!gov) {
    document.getElementById('stations').innerHTML = '<option value="">-- Select Station --</option>';
    document.getElementById('stations').disabled = true;
    return;
  }

  const cities = [...new Set(stationsData.filter(s => s.governorate === gov && s.city).map(s => s.city))].sort();
  cities.forEach(city => {
    const opt = document.createElement('option');
    opt.value = city;
    opt.textContent = city;
    cityDropdown.appendChild(opt);
  });
  cityDropdown.disabled = cities.length === 0;
}

function populateStations() {
  const gov = document.getElementById('governorate').value;
  const city = document.getElementById('city').value;
  const stationDropdown = document.getElementById('stations');
  stationDropdown.innerHTML = '<option value="">-- Select Station --</option>';
  stationDropdown.disabled = !city;
  if (!city) return;

  const filtered = stationsData
    .filter(s => s.governorate === gov && s.city === city)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  filtered.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = `${s.name} (${s.line})`;
    stationDropdown.appendChild(opt);
  });
  stationDropdown.disabled = filtered.length === 0;
}

async function loadStationsFromMetadata() {
  await refreshStationsData();
}

// ========== JOURNEY FLOW ==========
let selectedOrigin = null;
let selectedOriginLine = null;
let selectedOriginStationId = null;
let selectedDestination = null;
let selectedTrain = null;

document.getElementById("nextToDestination").addEventListener("click", () => {
  selectedOrigin = document.getElementById("stations").value;
  const errorDiv = document.getElementById("originError");

  if (!selectedOrigin) {
    errorDiv.style.display = "block";
    return;
  }

  const stationObj = stationsData.find(s => s.name === selectedOrigin);
  selectedOriginLine = stationObj?.line || null;
  selectedOriginStationId = stationObj?._id || null;

  if (!selectedOriginLine || !selectedOriginStationId) {
    errorDiv.textContent = "Unable to determine the selected station.";
    errorDiv.style.display = "block";
    return;
  }

  errorDiv.style.display = "none";
  const destDropdown = document.getElementById("destinationStations");
  destDropdown.innerHTML = '<option value="">-- Select Destination --</option>';

  const sameLineStations = stationsData
    .filter(s => s.line === selectedOriginLine && s.name !== selectedOrigin)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  sameLineStations.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.name;
    opt.textContent = s.name;
    destDropdown.appendChild(opt);
  });

  destDropdown.disabled = sameLineStations.length === 0;
  document.getElementById("originPanel").style.display = "none";
  document.getElementById("destinationPanel").style.display = "block";
  document.getElementById("destinationError").style.display = "none";
});

document.getElementById("backToOrigin").addEventListener("click", () => {
  document.getElementById("destinationPanel").style.display = "none";
  document.getElementById("originPanel").style.display = "block";
});

document.getElementById("confirmDestination").addEventListener("click", () => {
  selectedDestination = document.getElementById("destinationStations").value;
  const errorDiv = document.getElementById("destinationError");
  if (!selectedDestination) {
    errorDiv.style.display = "block";
    return;
  }

  errorDiv.style.display = "none";
  const trainSelect = document.getElementById("trainSelect");
  trainSelect.innerHTML = '<option value="">-- Choose a train --</option>';
  const baseTime = new Date(Date.now() + 10 * 60000);

  for (let i = 0; i < 4; i++) {
    const trainTime = new Date(baseTime.getTime() + i * 10 * 60000);
    const timeStr = trainTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const opt = document.createElement("option");
    opt.value = trainTime.toISOString();
    opt.textContent = `Train ${i + 1} - departs at ${timeStr}`;
    trainSelect.appendChild(opt);
  }

  document.getElementById("destinationPanel").style.display = "none";
  document.getElementById("trainSelectionPanel").style.display = "block";
  document.getElementById("trainError").style.display = "none";
});

document.getElementById("backToDestination").addEventListener("click", () => {
  document.getElementById("trainSelectionPanel").style.display = "none";
  document.getElementById("destinationPanel").style.display = "block";
});

document.getElementById("confirmTrain").addEventListener("click", () => {
  selectedTrain = document.getElementById("trainSelect").value;
  const errorDiv = document.getElementById("trainError");
  if (!selectedTrain) {
    errorDiv.style.display = "block";
    return;
  }

  errorDiv.style.display = "none";
  document.getElementById("trainSelectionPanel").style.display = "none";
  document.getElementById("waitingRoom").style.display = "block";

  // Join the selected origin station room as soon as the waiting room opens.
  joinStationRoom(selectedOriginStationId);

  const trainTime = new Date(selectedTrain);
  const departureTime = new Date(trainTime.getTime() + 5 * 60000);
  const arrivalStr = trainTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const departureStr = departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  document.getElementById("journeyInfo").innerHTML = `
    <strong>${escapeHtml(selectedOrigin)}</strong> → <strong>${escapeHtml(selectedDestination)}</strong><br>
    Line: ${escapeHtml(selectedOriginLine)}
  `;
  document.getElementById("waitingStatus").innerHTML = `
    🚆 <strong>Arrival:</strong> ${arrivalStr} &nbsp;|&nbsp; <strong>Departure:</strong> ${departureStr}<br>
    <span style="color: #93c5fd;">✅ Schedule confirmed</span>
  `;
  document.getElementById("countdown").textContent = "⏰ Train schedule is fixed. Please wait for your train.";
  
  // Start train animation
  animateTrainJourney(trainTime);
});

// ========== TRAIN ANIMATION ==========
function animateTrainJourney(trainTime) {
  const container = document.getElementById('trainAnimationContainer');
  const trainGroup = document.getElementById('trainGroup');
  const progressLine = document.getElementById('progressLine');
  const trainStatus = document.getElementById('trainStatus');
  
  container.style.display = 'block';
  
  const now = new Date();
  const arrivalTime = new Date(trainTime);
  const departureTime = new Date(trainTime.getTime() + 5 * 60000);
  const journeyStart = departureTime;
  const journeyEnd = new Date(journeyStart.getTime() + 15 * 60000); // 15 min journey
  
  let animationId = null;
  let trainPosition = 50; // Starting x position
  
  function updateAnimation() {
    const currentTime = new Date();
    let progress = 0;
    let status = '';
    
    if (currentTime < arrivalTime) {
      // Train is coming
      progress = Math.min((currentTime - now) / (arrivalTime - now), 1) * 0.2;
      status = `🚄 Train arriving in ${Math.ceil((arrivalTime - currentTime) / 1000)}s...`;
    } else if (currentTime < departureTime) {
      // Train at station
      progress = 0.2 + Math.sin((currentTime - arrivalTime) / 500) * 0.05;
      status = `🚉 Train boarding - Departs in ${Math.ceil((departureTime - currentTime) / 1000)}s...`;
    } else if (currentTime < journeyEnd) {
      // Train in journey
      progress = 0.2 + (currentTime - journeyStart) / (journeyEnd - journeyStart) * 0.75;
      const remainingTime = Math.ceil((journeyEnd - currentTime) / 1000);
      status = `🚄 In journey - Arrival in ${remainingTime}s...`;
    } else {
      // Journey complete
      progress = 1;
      status = `✅ Arrived at destination!`;
      trainStatus.style.color = '#10b981';
    }
    
    // Update train position and progress line
    trainPosition = 50 + (progress * 700);
    trainGroup.setAttribute('transform', `translate(${trainPosition}, 100)`);
    progressLine.setAttribute('x2', `${trainPosition}`);
    
    trainStatus.textContent = status;
    
    if (progress < 1) {
      animationId = requestAnimationFrame(updateAnimation);
    }
  }
  
  updateAnimation();
}

// ========== STATION ROOM MANAGEMENT ==========

document.getElementById("backToOriginFromWaiting").addEventListener("click", () => {
  leaveStationRoom();
  document.getElementById("waitingRoom").style.display = "none";
  document.getElementById("originPanel").style.display = "block";
});

// ========== ADMIN DASHBOARD ==========
function renderAdminDashboard() {
  const container = document.getElementById('adminContent');
  container.innerHTML = `
    <div style="display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap;">
      <button id="adminDashboardBtn" class="submit-btn" style="background:#3b82f6; padding:10px 20px; margin:0;">📊 Dashboard</button>
      <button id="adminStationsBtn" class="submit-btn" style="background:#f59e0b; padding:10px 20px; margin:0;">🚉 Manage Stations</button>
    </div>
    <div id="adminViewContainer"></div>
  `;
  document.getElementById('adminDashboardBtn').addEventListener('click', () => {
    currentAdminView = 'dashboard';
    showAdminDashboard();
  });
  document.getElementById('adminStationsBtn').addEventListener('click', () => {
    currentAdminView = 'stations';
    loadAdminStations();
  });
  showAdminDashboard();
}

async function showAdminDashboard() {
  const container = document.getElementById('adminViewContainer');
  try {
    const stationsRes = await fetch(`${API_BASE_URL}/api/v1/stations`);
    if (!stationsRes.ok) throw new Error('Failed to load stations');
    const stations = await stationsRes.json();
    const totalStations = Array.isArray(stations) ? stations.length : 0;
    const totalLines = Array.isArray(stations) ? [...new Set(stations.map(s => s.line))].length : 0;

    container.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px,1fr)); gap:16px; margin-bottom:20px;">
        <div style="background:#0f172a; padding:20px; border-radius:12px; text-align:center; border:1px solid #334155;">
          <div style="font-size:32px; font-weight:700; color:#3b82f6;">${totalStations}</div>
          <div style="color:#94a3b8;">Total Stations</div>
        </div>
        <div style="background:#0f172a; padding:20px; border-radius:12px; text-align:center; border:1px solid #334155;">
          <div style="font-size:32px; font-weight:700; color:#f59e0b;">${totalLines}</div>
          <div style="color:#94a3b8;">Total Lines</div>
        </div>
        <div style="background:#0f172a; padding:20px; border-radius:12px; text-align:center; border:1px solid #334155;">
          <div id="adminOnlineCountDisplay" style="font-size:32px; font-weight:700; color:#22c55e;">0</div>
          <div style="color:#94a3b8;">👥 Online Users</div>
        </div>
      </div>
      <div style="background:#0f172a; padding:16px; border-radius:12px; border:1px solid #334155;">
        <h4 style="color:#f1f5f9; margin-bottom:10px;">📋 Quick Actions</h4>
        <button onclick="document.getElementById('showAddStationForm').click()" class="submit-btn" style="background:#8b5cf6; padding:10px 20px; margin:5px;">➕ Add New Station</button>
      </div>
    `;
  } catch (err) {
    console.error('Dashboard error:', err);
    container.innerHTML = '<p style="color:#fca5a5;">Error loading dashboard.</p>';
  }
}

async function loadAdminStations() {
  const container = document.getElementById('adminViewContainer');
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/stations`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch stations');
    const stations = await res.json();

    let html = `<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:14px;">
      <thead><tr style="background:#0f172a; border-bottom:2px solid #334155;">
        <th style="padding:12px 10px; text-align:left; color:#94a3b8;">Name</th>
        <th style="padding:12px 10px; text-align:left; color:#94a3b8;">Line</th>
        <th style="padding:12px 10px; text-align:left; color:#94a3b8;">Governorate</th>
        <th style="padding:12px 10px; text-align:left; color:#94a3b8;">City</th>
        <th style="padding:12px 10px; text-align:left; color:#94a3b8;">Arrival</th>
        <th style="padding:12px 10px; text-align:left; color:#94a3b8;">Departure</th>
        <th style="padding:12px 10px; text-align:center; color:#94a3b8;">Actions</th>
      </tr></thead><tbody>`;

    if (stations.length === 0) {
      html += `<tr><td colspan="7" style="padding:20px; text-align:center; color:#94a3b8;">No stations found.</td></tr>`;
    } else {
      stations.forEach(s => {
        html += `<tr style="border-bottom:1px solid #1e293b;">
          <td style="padding:12px 10px; color:#f1f5f9;"><strong>${escapeHtml(s.name)}</strong></td>
          <td style="padding:12px 10px; color:#cbd5e1;">${escapeHtml(s.line)}</td>
          <td style="padding:12px 10px; color:#cbd5e1;">${escapeHtml(s.governorate || 'N/A')}</td>
          <td style="padding:12px 10px; color:#cbd5e1;">${escapeHtml(s.city || 'N/A')}</td>
          <td style="padding:12px 10px; color:#cbd5e1;">${escapeHtml(s.arrivalTime || 'N/A')}</td>
          <td style="padding:12px 10px; color:#cbd5e1;">${escapeHtml(s.departureTime || 'N/A')}</td>
          <td style="padding:12px 10px; text-align:center;">
            <button onclick="editStation('${s._id}')" style="background:#3b82f6; color:#fff; border:none; padding:6px 12px; border-radius:6px; margin-right:6px; cursor:pointer;">✏️ Edit</button>
            <button onclick="deleteStation('${s._id}')" style="background:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer;">🗑️ Delete</button>
          </td>
        </tr>`;
      });
    }
    html += `</tbody></table></div><p style="color:#94a3b8; margin-top:12px; font-size:13px;">✅ Changes appear instantly for all users.</p>`;
    container.innerHTML = html;
    currentAdminView = 'stations';
  } catch (err) {
    console.error('Admin load error:', err);
    container.innerHTML = '<p style="color:#fca5a5;">Failed to load stations.</p>';
  }
}

window.deleteStation = async function(id) {
  if (!confirm('Delete this station permanently?')) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/stations/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to delete');
    alert('✅ Station deleted');
    await refreshStationsData();
    loadAdminStations();
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

window.editStation = function(id) {
  const container = document.getElementById('adminViewContainer');
  fetch(`${API_BASE_URL}/api/v1/stations/${id}`, { headers: getAuthHeaders() })
    .then(async res => {
      if (!res.ok) throw new Error('Failed to load station');
      return res.json();
    })
    .then(station => {
      container.innerHTML = `
        <h4 style="color:#f1f5f9; margin-bottom:16px;">✏️ Edit Station</h4>
        <form id="editStationForm" style="display:flex; flex-direction:column; gap:12px;">
          <input type="hidden" id="editId" value="${station._id}">
          <label style="color:#cbd5e1;">Name</label><input type="text" id="editName" value="${escapeHtml(station.name)}" class="styled-dropdown" required>
          <label style="color:#cbd5e1;">Line</label><input type="text" id="editLine" value="${escapeHtml(station.line)}" class="styled-dropdown" required>
          <label style="color:#cbd5e1;">Order</label><input type="number" id="editOrder" value="${station.order}" class="styled-dropdown" required>
          <label style="color:#cbd5e1;">Governorate</label><input type="text" id="editGovernorate" value="${escapeHtml(station.governorate || '')}" class="styled-dropdown" required>
          <label style="color:#cbd5e1;">City</label><input type="text" id="editCity" value="${escapeHtml(station.city || '')}" class="styled-dropdown" required>
          <label style="color:#cbd5e1;">Arrival Time (HH:MM)</label><input type="text" id="editArrival" value="${escapeHtml(station.arrivalTime || '00:00')}" class="styled-dropdown" pattern="^([01]\\d|2[0-3]):[0-5]\\d$" required>
          <label style="color:#cbd5e1;">Departure Time (HH:MM)</label><input type="text" id="editDeparture" value="${escapeHtml(station.departureTime || '00:05')}" class="styled-dropdown" pattern="^([01]\\d|2[0-3]):[0-5]\\d$" required>
          <div style="display:flex; gap:10px; margin-top:10px;">
            <button type="submit" class="submit-btn" style="flex:1;">💾 Update</button>
            <button type="button" onclick="loadAdminStations()" class="back-btn" style="flex:1;">Cancel</button>
          </div>
        </form>`;

      document.getElementById('editStationForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
          name: document.getElementById('editName').value.trim(),
          line: document.getElementById('editLine').value.trim(),
          order: Number(document.getElementById('editOrder').value),
          governorate: document.getElementById('editGovernorate').value.trim(),
          city: document.getElementById('editCity').value.trim(),
          arrivalTime: document.getElementById('editArrival').value,
          departureTime: document.getElementById('editDeparture').value
        };
        try {
          const res = await fetch(`${API_BASE_URL}/api/v1/stations/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(body)
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Update failed');
          alert('✅ Station updated');
          await refreshStationsData();
          loadAdminStations();
        } catch (err) {
          alert('Error: ' + err.message);
        }
      });
    })
    .catch(err => {
      console.error(err);
      container.innerHTML = '<p style="color:#fca5a5;">Failed to load station details.</p>';
    });
};

document.getElementById('showAddStationForm').addEventListener('click', () => {
  const container = document.getElementById('adminViewContainer');
  container.innerHTML = `
    <h4 style="color:#f1f5f9; margin-bottom:16px;">➕ Add New Station</h4>
    <form id="addStationForm" style="display:flex; flex-direction:column; gap:12px;">
      <label style="color:#cbd5e1;">Name</label><input type="text" id="addName" placeholder="Station Name" class="styled-dropdown" required>
      <label style="color:#cbd5e1;">Line</label><input type="text" id="addLine" placeholder="e.g. Line 1" class="styled-dropdown" required>
      <label style="color:#cbd5e1;">Order</label><input type="number" id="addOrder" placeholder="1" class="styled-dropdown" required>
      <label style="color:#cbd5e1;">Governorate</label><input type="text" id="addGovernorate" placeholder="e.g. Cairo" class="styled-dropdown" required>
      <label style="color:#cbd5e1;">City</label><input type="text" id="addCity" placeholder="e.g. Helwan" class="styled-dropdown" required>
      <label style="color:#cbd5e1;">Arrival Time (HH:MM)</label><input type="text" id="addArrival" placeholder="00:00" class="styled-dropdown" pattern="^([01]\\d|2[0-3]):[0-5]\\d$" required>
      <label style="color:#cbd5e1;">Departure Time (HH:MM)</label><input type="text" id="addDeparture" placeholder="00:05" class="styled-dropdown" pattern="^([01]\\d|2[0-3]):[0-5]\\d$" required>
      <div style="display:flex; gap:10px; margin-top:10px;">
        <button type="submit" class="submit-btn" style="flex:1;">➕ Add</button>
        <button type="button" onclick="loadAdminStations()" class="back-btn" style="flex:1;">Cancel</button>
      </div>
    </form>`;

  document.getElementById('addStationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      name: document.getElementById('addName').value.trim(),
      line: document.getElementById('addLine').value.trim(),
      order: Number(document.getElementById('addOrder').value),
      governorate: document.getElementById('addGovernorate').value.trim(),
      city: document.getElementById('addCity').value.trim(),
      arrivalTime: document.getElementById('addArrival').value,
      departureTime: document.getElementById('addDeparture').value
    };
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/stations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Add failed');
      alert('✅ Station added');
      await refreshStationsData();
      loadAdminStations();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  });
});
