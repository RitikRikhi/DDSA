const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { authenticate, requireRoles } = require('../middleware/authMiddleware');

/**
 * GET /api/activity-logs
 * Audit trail of system actions
 */
router.get('/', authenticate, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { page = 1, limit = 50, action, entityType } = req.query;

    const where = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip,
        take,
        orderBy: { timestamp: 'desc' },
        include: { user: true }
      }),
      prisma.activityLog.count({ where })
    ]);

    const formatted = logs.map(l => ({
      id: l.id,
      action: l.action,
      userName: l.userName || l.user?.name || 'System',
      userId: l.userId,
      entityType: l.entityType,
      entityId: l.entityId,
      details: l.details,
      timestamp: l.timestamp
    }));

    return res.status(200).json({
      success: true,
      data: formatted,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / take)
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
