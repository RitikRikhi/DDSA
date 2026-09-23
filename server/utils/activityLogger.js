const prisma = require('../config/prisma');

/**
 * Log an activity event to the ActivityLog table.
 */
async function logActivity({ userId, userName, action, entityType, entityId, details }) {
  try {
    const log = await prisma.activityLog.create({
      data: {
        userId: userId || null,
        userName: userName || 'System',
        action,
        entityType: entityType || null,
        entityId: entityId || null,
        details: typeof details === 'object' ? JSON.stringify(details) : details || null
      }
    });
    return log;
  } catch (err) {
    console.warn('Activity logging warning (non-fatal):', err.message);
    return null;
  }
}

module.exports = { logActivity };
