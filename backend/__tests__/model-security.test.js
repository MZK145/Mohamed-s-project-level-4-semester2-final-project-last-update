const bcrypt = require('bcrypt');
const Admin = require('../models/Admin');
const User = require('../models/User');

describe('authentication model hardening', () => {
  test('Admin comparePassword accepts the correct password and rejects a wrong one', async () => {
    const admin = new Admin({ email: 'admin@example.com', password: await bcrypt.hash('password123', 12) });
    await expect(admin.comparePassword('password123')).resolves.toBe(true);
    await expect(admin.comparePassword('wrong-password')).resolves.toBe(false);
  });

  test('User comparePassword accepts the correct password and rejects a wrong one', async () => {
    const user = new User({ name: 'Test User', email: 'user@example.com', password: await bcrypt.hash('password123', 12) });
    await expect(user.comparePassword('password123')).resolves.toBe(true);
    await expect(user.comparePassword('wrong-password')).resolves.toBe(false);
  });

  test('password fields are hidden from JSON output', () => {
    const admin = new Admin({ email: 'admin@example.com', password: 'hash' });
    const user = new User({ name: 'Test User', email: 'user@example.com', password: 'hash' });
    expect(admin.toJSON().password).toBeUndefined();
    expect(user.toJSON().password).toBeUndefined();
  });
});
