const prisma = require('../config/prisma');

/**
 * Create a system or user notification.
 */
async function createNotification({ title, message, type = 'info', userId = null }) {
  try {
    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type,
        userId: userId || null,
        readStatus: false
      }
    });
    return notification;
  } catch (err) {
    console.warn('Notification creation warning (non-fatal):', err.message);
    return null;
  }
}

module.exports = { createNotification };
