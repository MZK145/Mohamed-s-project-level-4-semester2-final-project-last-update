require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');

async function run() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  }
  if (password.length < 6 || password.length > 128) {
    throw new Error('ADMIN_PASSWORD must be 6–128 characters');
  }
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');

  await mongoose.connect(process.env.MONGO_URI);

  const existing = await Admin.findOne({ email });
  const admin = existing || new Admin({ email, password });
  admin.email = email;
  admin.password = password;
  await admin.save();

  console.log(`Admin ready: ${admin.email}`);
  await mongoose.disconnect();
}

run().catch(async error => {
  console.error('Admin seed failed:', error.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
