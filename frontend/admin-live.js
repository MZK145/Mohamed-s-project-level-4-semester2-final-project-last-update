(function () {
  const API_BASE_URL = window.BACKEND_URL || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5000'
      : window.location.origin
  );

  async function refreshAdminOnlineCount() {
    if (localStorage.getItem('role') !== 'admin') return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/users/online`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (!response.ok) return;

      const data = await response.json();
      const count = Number(data.count || 0);
      const display = document.getElementById('adminOnlineCountDisplay');
      if (display) display.textContent = String(count);
    } catch (error) {
      console.error('Could not refresh waiting-room user count:', error);
    }
  }

  refreshAdminOnlineCount();
  setInterval(refreshAdminOnlineCount, 1500);
})();
