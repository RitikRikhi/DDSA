const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { signToken, authenticate } = require('../middleware/authMiddleware');
const { validate, loginSchema, registerSchema } = require('../middleware/validation');
const { logActivity } = require('../utils/activityLogger');

/**
 * POST /api/auth/login
 * Public endpoint to authenticate user and return JWT session
 */
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Search in User table
    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { role: true, department: true }
    });

    // Fallback: If not found, check Admin table for legacy admin logins if Mongo connected
    const mongoose = require('mongoose');
    if (!user && mongoose.connection.readyState === 1) {
      try {
        const Admin = require('../models/Admin');
        const legacyAdmin = await Admin.findOne({ email: email.toLowerCase() });
        if (legacyAdmin) {
          const isMatch = await bcrypt.compare(password, legacyAdmin.password);
          if (isMatch) {
            let adminRole = await prisma.role.findFirst({
              where: { key: 'SUPER_ADMIN' }
            });
            if (!adminRole) {
              adminRole = await prisma.role.create({
                data: {
                  name: 'Super Admin',
                  key: 'SUPER_ADMIN',
                  permissions: JSON.stringify(['ALL'])
                }
              });
            }

            user = await prisma.user.create({
              data: {
                name: 'Super Admin',
                email: legacyAdmin.email.toLowerCase(),
                password: legacyAdmin.password,
                roleId: adminRole.id,
                roleName: 'Super Admin',
                category: 'Management',
                skills: JSON.stringify(['Leadership', 'Production', 'System Architecture'])
              },
              include: { role: true, department: true }
            });
          }
        }
      } catch (e) {}
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }

    // Compare password
    const isPasswordValid = user.password 
      ? await bcrypt.compare(password, user.password)
      : password === 'admin123'; // fallback for seeded users

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role?.key || 'SUPER_ADMIN'
    });

    // Log login activity
    await logActivity({
      userId: user.id,
      userName: user.name,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      details: `User ${user.name} logged in successfully`
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        year: user.year,
        department: user.department?.name || user.category || 'General',
        departmentId: user.departmentId,
        role: user.role?.name || user.roleName || 'Admin',
        roleKey: user.role?.key || 'ADMIN',
        permissions: user.role?.permissions ? JSON.parse(user.role.permissions) : [],
        attendancePercentage: user.attendancePercentage
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { name, email, password, role, department, phone } = req.body;

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'An account with this email already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Find role or default to Volunteer
    let roleRecord = null;
    if (role) {
      roleRecord = await prisma.role.findFirst({
        where: { name: { contains: role } }
      });
    }
    if (!roleRecord) {
      roleRecord = await prisma.role.findFirst({ where: { key: 'VOLUNTEER' } });
    }

    // Find department
    let deptRecord = null;
    if (department) {
      deptRecord = await prisma.department.findFirst({
        where: { name: { contains: department } }
      });
    }

    const newUser = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        phone: phone || null,
        roleId: roleRecord ? roleRecord.id : null,
        roleName: roleRecord ? roleRecord.name : 'Volunteer',
        departmentId: deptRecord ? deptRecord.id : null,
        category: deptRecord ? deptRecord.name : 'General',
        skills: JSON.stringify(['Media Production'])
      },
      include: { role: true, department: true }
    });

    const token = signToken({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role?.key || 'VOLUNTEER'
    });

    await logActivity({
      userId: newUser.id,
      userName: newUser.name,
      action: 'REGISTER',
      entityType: 'User',
      entityId: newUser.id,
      details: `New account created for ${newUser.name}`
    });

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role?.name || 'Volunteer',
        department: newUser.department?.name || 'General'
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

/**
 * GET /api/auth/session or /api/auth/me
 * Returns current authenticated user profile
 */
router.get(['/session', '/me'], authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { role: true, department: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'User session not found'
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        bannerImage: user.bannerImage,
        year: user.year,
        skills: typeof user.skills === 'string' ? JSON.parse(user.skills || '[]') : user.skills,
        attendancePercentage: user.attendancePercentage,
        department: user.department?.name || user.category || 'General',
        departmentId: user.departmentId,
        role: user.role?.name || user.roleName || 'Member',
        roleKey: user.role?.key || req.user.role,
        permissions: user.role?.permissions ? JSON.parse(user.role.permissions) : []
      }
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
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;