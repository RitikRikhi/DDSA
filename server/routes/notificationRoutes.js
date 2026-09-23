const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { optionalAuth, authenticate } = require('../middleware/authMiddleware');
const { validate, notificationCreateSchema } = require('../middleware/validation');

/**
 * GET /api/notifications
 * List recent notifications
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const where = {};
    if (req.user) {
      where.OR = [
        { userId: req.user.id },
        { userId: null }
      ];
    }

    const notifications = await prisma.notification.findMany({
      where,
      take: 30,
      orderBy: { createdAt: 'desc' }
    });

    const unreadCount = notifications.filter(n => !n.readStatus).length;

    return res.status(200).json({
      success: true,
      unreadCount,
      data: notifications
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await prisma.notification.update({
      where: { id },
      data: { readStatus: true }
    });

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: updated
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read
 */
router.post('/read-all', optionalAuth, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { readStatus: false },
      data: { readStatus: true }
    });

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

/**
 * POST /api/notifications
 * Create custom notification
 */
router.post('/', validate(notificationCreateSchema), async (req, res) => {
  try {
    const { title, message, type = 'info', userId } = req.body;
    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type,
        userId: userId || null
      }
    });

    return res.status(201).json({
      success: true,
      data: notification
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

module.exports = router;
