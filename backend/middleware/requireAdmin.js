const jwt = require('jsonwebtoken');

function requireAdmin(req, res, next) {
  const match = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'Authentication required' });

  try {
    const decoded = jwt.verify(match[1], process.env.JWT_SECRET, {
      issuer: 'metrosync-api',
      audience: 'metrosync-client'
    });

    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
}

module.exports = requireAdmin;
