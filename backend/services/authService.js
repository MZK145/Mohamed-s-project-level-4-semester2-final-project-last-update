const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const User = require('../models/User');

function fail(message, statusCode) {
  throw Object.assign(new Error(message), { statusCode });
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret || secret.length < 32) fail('JWT_SECRET must be configured with at least 32 characters', 500);
  return secret;
}

function issueToken(account, role, email) {
  return jwt.sign(
    { id: String(account._id), role, email },
    getJwtSecret(),
    {
      expiresIn: '8h',
      issuer: 'metrosync-api',
      audience: 'metrosync-client'
    }
  );
}

exports.login = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const cleanPassword = String(password || '');

  if (!normalizedEmail || !cleanPassword) fail('Email and password are required', 400);
  if (cleanPassword.length < 6 || cleanPassword.length > 128) {
    fail('Password must be 6–128 characters long', 400);
  }

  const admin = await Admin.findOne({ email: normalizedEmail }).select('+password');
  if (admin) {
    const match = await admin.comparePassword(cleanPassword).catch(() => false);
    if (!match) fail('Invalid credentials', 401);
    return { token: issueToken(admin, 'admin', normalizedEmail), role: 'admin' };
  }

  const user = await User.findOne({ email: normalizedEmail }).select('+password');
  if (!user) fail('Invalid credentials', 401);

  const match = await user.comparePassword(cleanPassword).catch(() => false);
  if (!match) fail('Invalid credentials', 401);

  return { token: issueToken(user, 'user', normalizedEmail), role: 'user' };
};
