const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

jest.mock('../models/Station', () => ({
  find: jest.fn()
}));

jest.mock('../models/Admin', () => ({
  findOne: jest.fn()
}));

jest.mock('../models/User', () => ({
  findOne: jest.fn()
}));

jest.mock('../services/announcementService', () => ({
  fetchAnnouncements: jest.fn(),
  createAnnouncement: jest.fn()
}));

const Station = require('../models/Station');
const Admin = require('../models/Admin');
const User = require('../models/User');
const announcementService = require('../services/announcementService');
const app = require('../app');

const testAdminEmail = 'jest-admin@metro.test';
const testAdminId = new mongoose.Types.ObjectId();
const testStation = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Jest Test Station',
  line: 'Test Line',
  order: 999,
  governorate: 'Cairo',
  city: 'Test City'
};

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-only-jwt-secret-with-at-least-32-chars';
});

beforeEach(async () => {
  jest.clearAllMocks();

  const passwordHash = await bcrypt.hash('password123', 10);
  const adminRecord = {
    _id: testAdminId,
    email: testAdminEmail,
    password: passwordHash,
    comparePassword: jest.fn().mockResolvedValue(true)
  };

  Station.find.mockReturnValue({
    sort: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([testStation])
    })
  });

  Admin.findOne.mockReturnValue({
    select: jest.fn().mockResolvedValue(adminRecord)
  });

  User.findOne.mockReturnValue({
    select: jest.fn().mockResolvedValue(null)
  });

  announcementService.createAnnouncement.mockResolvedValue({
    _id: new mongoose.Types.ObjectId(),
    stationId: testStation._id,
    message: 'Test station announcement'
  });
});

describe('API Tests', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /api/v1/stations returns a sorted array', async () => {
    const res = await request(app).get('/api/v1/stations');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ name: testStation.name })]);
    expect(Station.find).toHaveBeenCalledWith();
  });

  it('valid admin login returns a JWT', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testAdminEmail, password: 'password123' });

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.role).toBe('admin');
  });

  it('protected announcement creation without a token returns 401', async () => {
    const res = await request(app)
      .post(`/api/v1/stations/${testStation._id}/announcements`)
      .send({ message: 'Unauthorized test announcement' });

    expect(res.statusCode).toBe(401);
  });

  it('protected announcement creation with a valid admin token returns 201', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testAdminEmail, password: 'password123' });

    expect(login.statusCode).toBe(200);

    const res = await request(app)
      .post(`/api/v1/stations/${testStation._id}/announcements`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ message: 'Test station announcement' });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe('Test station announcement');
  });
});
