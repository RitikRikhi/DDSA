const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');

/**
 * GET /api/departments
 * List all departments with member count
 */
router.get('/departments', async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: { users: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    const formatted = departments.map(d => ({
      id: d.id,
      name: d.name,
      description: d.description,
      memberCount: d._count.users
    }));

    return res.status(200).json({
      success: true,
      data: formatted
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
 * GET /api/roles
 * List all system roles
 */
router.get('/roles', async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        _count: {
          select: { users: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    const formatted = roles.map(r => ({
      id: r.id,
      name: r.name,
      key: r.key,
      permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions || '[]') : r.permissions,
      userCount: r._count.users
    }));

    return res.status(200).json({
      success: true,
      data: formatted
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
