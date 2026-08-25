const express = require('express');
const { body, validationResult } = require('express-validator');
const announcementController = require('../controllers/announcementController');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

router.get('/:id/announcements', announcementController.getAnnouncements);

router.post(
  '/:id/announcements',
  requireAdmin,
  body('message')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Announcement message must be between 1 and 500 characters'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error(errors.array()[0].msg);
      error.status = 400;
      return next(error);
    }
    next();
  },
  announcementController.createAnnouncement
);

module.exports = router;
