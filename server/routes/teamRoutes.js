const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const prisma = require('../config/prisma');
const teamDataPath = path.join(__dirname, '../data/team.json');

/**
 * GET /api/team
 * Returns creators list formatted for the team roster and cards
 */
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;

    if (fs.existsSync(teamDataPath)) {
      let team = JSON.parse(fs.readFileSync(teamDataPath, 'utf8'));
      if (category && category !== 'all') {
        team = team.filter(m => 
          (m.category && m.category.toLowerCase().includes(category.toLowerCase())) ||
          (m.department && m.department.toLowerCase().includes(category.toLowerCase())) ||
          (m.role && m.role.toLowerCase().includes(category.toLowerCase()))
        );
      }
      if (search) {
        const s = search.toLowerCase();
        team = team.filter(m => 
          (m.name && m.name.toLowerCase().includes(s)) ||
          (m.role && m.role.toLowerCase().includes(s)) ||
          (Array.isArray(m.skills) && m.skills.some(sk => sk.toLowerCase().includes(s)))
        );
      }
      return res.status(200).json(team);
    }

    const where = {};
    if (category && category !== 'all') {
      where.OR = [
        { category: { contains: category } },
        { department: { name: { contains: category } } }
      ];
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { roleName: { contains: search } },
        { skills: { contains: search } }
      ];
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        role: true,
        department: true
      },
      orderBy: { name: 'asc' }
    });

    const formatted = users.map(u => {
      let skills = ['Storytelling', 'Production'];
      try {
        skills = typeof u.skills === 'string' ? JSON.parse(u.skills || '[]') : (u.skills || []);
      } catch (e) {
        skills = [u.skills || 'Production'];
      }

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role?.name || u.roleName || 'Creator',
        roleKey: u.role?.key || 'VOLUNTEER',
        category: u.department?.name || u.category || 'Photography',
        department: u.department?.name || u.category || 'Photography',
        departmentId: u.departmentId,
        year: u.year || '3rd Year',
        image: u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
        avatar: u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
        bannerImage: u.bannerImage || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
        overlayImage: u.bannerImage || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
        skills,
        attendancePercentage: u.attendancePercentage,
        status: 'Available'
      };
    });

    return res.status(200).json(formatted);
  } catch (err) {
    console.error('Fetch team error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

/**
 * GET /api/team/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { role: true, department: true, mediaAssets: true, assignments: { include: { event: true } } }
    });

    if (!user) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    let skills = [];
    try {
      skills = typeof user.skills === 'string' ? JSON.parse(user.skills || '[]') : (user.skills || []);
    } catch (e) {
      skills = [user.skills || 'Production'];
    }

    return res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role?.name || user.roleName,
      category: user.department?.name || user.category,
      image: user.avatar,
      bannerImage: user.bannerImage,
      skills,
      portfolio: user.mediaAssets,
      assignments: user.assignments
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/team
 * Create a new team creator
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, role, category, department, image, avatar, bannerImage, skills, bio } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Creator name is required' });
    }

    const uniqueEmail = email || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}@dsa.com`;
    
    // Find department if exists
    let deptId = null;
    const deptName = department || category || 'Photography';
    const dept = await prisma.department.findFirst({
      where: { name: { contains: deptName } }
    });
    if (dept) deptId = dept.id;

    // Find role if exists
    let roleId = null;
    const rName = role || 'Photographer';
    const r = await prisma.role.findFirst({
      where: { name: { contains: rName } }
    });
    if (r) roleId = r.id;

    const newCreator = await prisma.user.create({
      data: {
        name,
        email: uniqueEmail,
        password: '$2a$10$SampleHashedPasswordForSeedOnlyXXXXXXXXXXXXXXX',
        roleId: roleId || undefined,
        departmentId: deptId || undefined,
        category: deptName,
        roleName: rName,
        avatar: image || avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
        bannerImage: bannerImage || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
        skills: JSON.stringify(Array.isArray(skills) ? skills : [skills || 'Storytelling'])
      },
      include: { role: true, department: true }
    });

    return res.status(201).json({
      success: true,
      message: 'Creator registered successfully',
      data: newCreator,
      member: newCreator
    });
  } catch (err) {
    console.error('Create creator error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/team/:id
 * Update an existing team creator
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, email, role, category, department, image, avatar, bannerImage, skills, bio } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (category || department) updateData.category = category || department;
    if (role) updateData.roleName = role;
    if (image || avatar) updateData.avatar = image || avatar;
    if (bannerImage) updateData.bannerImage = bannerImage;
    if (skills) updateData.skills = JSON.stringify(Array.isArray(skills) ? skills : [skills]);
    if (bio !== undefined) updateData.bio = bio;

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      include: { role: true, department: true }
    });

    return res.status(200).json({
      success: true,
      message: 'Creator updated successfully',
      data: updated,
      member: updated
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/team/:id
 * Delete a creator
 */
router.delete('/:id', async (req, res) => {
  try {
    await prisma.user.delete({
      where: { id: req.params.id }
    });
    return res.status(200).json({
      success: true,
      message: 'Creator removed successfully'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

