const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { authenticate, requireRoles, optionalAuth } = require('../middleware/authMiddleware');
const { validate, userCreateSchema, userUpdateSchema } = require('../middleware/validation');
const { logActivity } = require('../utils/activityLogger');

/**
 * Format user object for clean API response
 */
function formatUser(u) {
  let skills = [];
  try {
    skills = typeof u.skills === 'string' ? JSON.parse(u.skills || '[]') : (u.skills || []);
  } catch (e) {
    skills = u.skills ? [u.skills] : [];
  }

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    avatar: u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
    image: u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800', // alias for frontend compatibility
    bannerImage: u.bannerImage || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
    overlayImage: u.bannerImage || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
    year: u.year || '3rd Year',
    department: u.department?.name || u.category || 'General',
    departmentId: u.departmentId,
    category: u.department?.name || u.category || 'General',
    role: u.role?.name || u.roleName || 'Member',
    roleKey: u.role?.key || 'VOLUNTEER',
    roleId: u.roleId,
    skills,
    attendancePercentage: u.attendancePercentage,
    createdAt: u.createdAt
  };
}

/**
 * GET /api/users
 * Search, filter by department, role, year, and pagination
 */
router.get('/', async (req, res) => {
  try {
    const { department, role, category, year, search, page = 1, limit = 100, sort = 'name' } = req.query;

    const where = {};

    if (department && department !== 'all') {
      where.OR = [
        { department: { name: { contains: department } } },
        { category: { contains: department } }
      ];
    } else if (category && category !== 'all') {
      where.OR = [
        { department: { name: { contains: category } } },
        { category: { contains: category } }
      ];
    }

    if (role && role !== 'all') {
      where.OR = [
        { role: { name: { contains: role } } },
        { role: { key: { contains: role.toUpperCase() } } },
        { roleName: { contains: role } }
      ];
    }

    if (year) {
      where.year = { contains: year };
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { roleName: { contains: search } },
        { category: { contains: search } },
        { skills: { contains: search } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: { role: true, department: true },
        skip,
        take,
        orderBy: sort === 'attendance' 
          ? { attendancePercentage: 'desc' } 
          : sort === 'newest' 
            ? { createdAt: 'desc' } 
            : { name: 'asc' }
      }),
      prisma.user.count({ where })
    ]);

    const formatted = users.map(formatUser);

    return res.status(200).json({
      success: true,
      data: formatted,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / take)
    });
  } catch (err) {
    console.error('Fetch users error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

/**
 * GET /api/users/:id
 * Retrieve a single user with full profile, assignments, and media
 */
router.get('/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        role: true,
        department: true,
        assignments: {
          include: { event: true }
        },
        attendanceRecords: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        },
        mediaAssets: {
          take: 12,
          orderBy: { createdAt: 'desc' }
        },
        borrowRecords: {
          include: { equipment: true },
          take: 5,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Member not found'
      });
    }

    const formatted = formatUser(user);
    formatted.assignments = user.assignments;
    formatted.attendanceHistory = user.attendanceRecords;
    formatted.portfolio = user.mediaAssets;
    formatted.borrowHistory = user.borrowRecords;

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
 * POST /api/users
 * Create a new team member
 */
router.post('/', authenticate, requireRoles('SUPER_ADMIN', 'ADMIN', 'TECHNICAL_HEAD'), validate(userCreateSchema), async (req, res) => {
  try {
    const { name, email, password, phone, avatar, departmentId, department, roleId, role, year, skills, attendancePercentage } = req.body;

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Conflict',
        message: 'A member with this email already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password || 'dsa2026', 10);

    // Resolve department
    let targetDeptId = departmentId;
    let deptName = department;
    if (!targetDeptId && department) {
      const d = await prisma.department.findFirst({
        where: { name: { contains: department } }
      });
      if (d) {
        targetDeptId = d.id;
        deptName = d.name;
      }
    }

    // Resolve role
    let targetRoleId = roleId;
    let rName = role;
    if (!targetRoleId && role) {
      const r = await prisma.role.findFirst({
        where: { name: { contains: role } }
      });
      if (r) {
        targetRoleId = r.id;
        rName = r.name;
      }
    }

    const newUser = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        phone: phone || null,
        avatar: avatar || null,
        year: year || '3rd Year',
        skills: Array.isArray(skills) ? JSON.stringify(skills) : (typeof skills === 'string' ? JSON.stringify([skills]) : '[]'),
        attendancePercentage: attendancePercentage !== undefined ? attendancePercentage : 95.0,
        departmentId: targetDeptId || null,
        category: deptName || 'General',
        roleId: targetRoleId || null,
        roleName: rName || 'Volunteer'
      },
      include: { role: true, department: true }
    });

    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      action: 'CREATE_USER',
      entityType: 'User',
      entityId: newUser.id,
      details: `Created new member ${newUser.name} (${newUser.roleName})`
    });

    return res.status(201).json({
      success: true,
      message: 'Member created successfully',
      data: formatUser(newUser)
    });
  } catch (err) {
    console.error('Create user error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

/**
 * PATCH /api/users/:id
 * Update team member profile
 */
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, phone, avatar, bannerImage, departmentId, department, roleId, role, year, skills, attendancePercentage } = req.body;

    // Check permissions: Super Admin, Admin, or editing self
    const isSelf = req.user.id === id;
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);

    if (!isSelf && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only update your own profile unless you are an administrator.'
      });
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'User not found'
      });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase();
    if (phone !== undefined) updateData.phone = phone;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (bannerImage !== undefined) updateData.bannerImage = bannerImage;
    if (year !== undefined) updateData.year = year;
    if (attendancePercentage !== undefined) updateData.attendancePercentage = attendancePercentage;
    if (skills !== undefined) {
      updateData.skills = Array.isArray(skills) ? JSON.stringify(skills) : JSON.stringify([skills]);
    }

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    if (isAdmin) {
      if (departmentId !== undefined) updateData.departmentId = departmentId;
      if (department !== undefined) {
        updateData.category = department;
        const d = await prisma.department.findFirst({ where: { name: { contains: department } } });
        if (d) updateData.departmentId = d.id;
      }
      if (roleId !== undefined) updateData.roleId = roleId;
      if (role !== undefined) {
        updateData.roleName = role;
        const r = await prisma.role.findFirst({ where: { name: { contains: role } } });
        if (r) updateData.roleId = r.id;
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { role: true, department: true }
    });

    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      action: 'UPDATE_USER',
      entityType: 'User',
      entityId: updated.id,
      details: `Updated profile for ${updated.name}`
    });

    return res.status(200).json({
      success: true,
      message: 'Member updated successfully',
      data: formatUser(updated)
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
 * DELETE /api/users/:id
 * Remove a user from the system
 */
router.delete('/:id', authenticate, requireRoles('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Member not found'
      });
    }

    await prisma.user.delete({ where: { id } });

    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      action: 'DELETE_USER',
      entityType: 'User',
      entityId: id,
      details: `Deleted member ${existing.name}`
    });

    return res.status(200).json({
      success: true,
      message: `Member ${existing.name} deleted successfully`
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
