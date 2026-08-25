const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const router = express.Router();
const Station = require('../models/Station');
const requireAdmin = require('../middleware/requireAdmin');
const stationController = require('../controllers/stationController');

const validateStation = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Station name is required'),
  body('line').trim().isLength({ min: 1, max: 50 }).withMessage('Line is required'),
  body('order').isInt({ min: 1 }).withMessage('Order must be a positive integer'),
  body('governorate').trim().isLength({ min: 2, max: 100 }).withMessage('Governorate is required'),
  body('city').trim().isLength({ min: 2, max: 100 }).withMessage('City is required'),
  body('arrivalTime').optional({ values: 'falsy' }).matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Arrival time must be HH:MM'),
  body('departureTime').optional({ values: 'falsy' }).matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Departure time must be HH:MM'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    next();
  }
];

router.get('/', stationController.getStations);

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid station id' });
    const station = await Station.findById(req.params.id);
    if (!station) return res.status(404).json({ error: 'Station not found' });
    res.status(200).json(station);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdmin, validateStation, async (req, res, next) => {
  try {
    const duplicate = await Station.findOne({ name: req.body.name, line: req.body.line });
    if (duplicate) return res.status(409).json({ error: 'Station already exists on this line' });

    const station = await Station.create(req.body);
    req.app.locals.io?.emit('stationsUpdated');
    res.status(201).json(station);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAdmin, validateStation, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid station id' });
    const station = await Station.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!station) return res.status(404).json({ error: 'Station not found' });

    req.app.locals.io?.emit('stationsUpdated');
    res.status(200).json(station);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid station id' });
    const station = await Station.findByIdAndDelete(req.params.id);
    if (!station) return res.status(404).json({ error: 'Station not found' });

    req.app.locals.io?.emit('stationsUpdated');
    res.status(200).json({ message: 'Station deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
