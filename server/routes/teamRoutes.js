const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const prisma = require('../config/prisma');
const { authenticate, requireRoles } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validation');
const { logActivity } = require('../utils/activityLogger');
const { formatMedia } = require('./mediaRoutes');
const teamDataPath = path.join(__dirname, '../data/team.json');

// Only admins manage site content
const adminOnly = [authenticate, requireRoles('ADMIN')];

const TEAM_CATEGORIES = ['leader', 'photography', 'videography', 'design', 'editing', 'content', 'tech', 'vlogging', 'onscreen'];

const slugify = (text) => String(text || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80) || 'member';

async function uniqueUserSlug(base, excludeId = null) {
  let candidate = base;
  for (let i = 2; ; i++) {
    const clash = await prisma.user.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) }
    });
    if (!clash) return candidate;
    candidate = `${base}-${i}`;
  }
}

const parseJson = (value, fallback) => {
  try {
    return typeof value === 'string' ? JSON.parse(value) : (value ?? fallback);
  } catch (e) {
    return fallback;
  }
};

/**
 * Full profile shape used by the admin panel
 */
function formatProfile(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    slug: u.slug,
    displayRole: u.displayRole || null,
    accessRole: u.role?.name || u.roleName || null,
    teamCategory: u.teamCategory || null,
    year: u.year,
    bio: u.bio || '',
    tagline: u.tagline || '',
    specialty: u.specialty || '',
    skills: parseJson(u.skills, []),
    socials: parseJson(u.socials, {}),
    mediaDNA: parseJson(u.mediaDNA, {}),
    credits: parseJson(u.credits, []),
    avatar: u.avatar,
    bannerImage: u.bannerImage,
    isPublic: u.isPublic,
    displayOrder: u.displayOrder,
    portfolioCount: u._count?.mediaCredits,
    updatedAt: u.updatedAt
  };
}

const optionalUrl = z.string().max(1000).nullable().optional();

const profileSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may only contain lowercase letters, numbers and dashes').max(80).optional(),
  displayRole: z.string().max(80).nullable().optional(),
  teamCategory: z.enum(TEAM_CATEGORIES).nullable().optional(),
  year: z.string().max(30).nullable().optional(),
  bio: z.string().max(3000).nullable().optional(),
  tagline: z.string().max(200).nullable().optional(),
  specialty: z.string().max(200).nullable().optional(),
  skills: z.array(z.string().max(60)).max(30).optional(),
  socials: z.record(z.string(), z.string().max(300)).optional(),
  mediaDNA: z.record(z.string(), z.number().min(0).max(100)).optional(),
  credits: z.array(z.string().max(120)).max(50).optional(),
  avatar: optionalUrl,
  bannerImage: optionalUrl,
  isPublic: z.boolean().optional(),
  displayOrder: z.number().int().optional()
});

const profileUpdateSchema = profileSchema.partial();

function profileData(body) {
  const data = {};
  for (const key of ['name', 'displayRole', 'teamCategory', 'year', 'bio', 'tagline', 'specialty', 'avatar', 'bannerImage', 'isPublic', 'displayOrder']) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  for (const key of ['skills', 'socials', 'mediaDNA', 'credits']) {
    if (body[key] !== undefined) data[key] = JSON.stringify(body[key]);
  }
  return data;
}

/**
 * GET /api/team/manage
 * Admin list of all members with profile fields. Query: search, visibility (public|hidden), teamCategory
 */
router.get('/manage', ...adminOnly, async (req, res) => {
  try {
    const { search, visibility, teamCategory } = req.query;
    const where = {};
    if (visibility === 'public') where.isPublic = true;
    if (visibility === 'hidden') where.isPublic = false;
    if (teamCategory && teamCategory !== 'all') where.teamCategory = teamCategory;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { displayRole: { contains: search } },
        { email: { contains: search } }
      ];
    }

    const users = await prisma.user.findMany({
      where,
      include: { role: true, _count: { select: { mediaCredits: true } } },
      orderBy: [{ isPublic: 'desc' }, { displayOrder: 'asc' }, { name: 'asc' }]
    });

    return res.status(200).json({ success: true, data: users.map(formatProfile) });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
  }
});

/**
 * GET /api/team/manage/:id
 * Admin view of one member, including credited portfolio media
 */
router.get('/manage/:id', ...adminOnly, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        role: true,
        mediaCredits: {
          include: { media: { include: { event: true, uploadedBy: true, credits: { include: { user: { select: { id: true, name: true } } } } } } },
          orderBy: { media: { sortOrder: 'asc' } }
        }
      }
    });
    if (!user) {
      return res.status(404).json({ success: false, error: 'Not Found', message: 'Team member not found' });
    }

    const profile = formatProfile(user);
    profile.portfolio = user.mediaCredits.map(c => ({ ...formatMedia(c.media), creditRole: c.role }));
    return res.status(200).json({ success: true, data: profile });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
  }
});

/**
 * PATCH /api/team/reorder
 * Body: { items: [{ id, displayOrder }] }
 */
router.patch('/reorder', ...adminOnly, validate(z.object({
  items: z.array(z.object({ id: z.string(), displayOrder: z.number().int() })).min(1).max(500)
})), async (req, res) => {
  try {
    await prisma.$transaction(
      req.body.items.map(({ id, displayOrder }) => prisma.user.update({ where: { id }, data: { displayOrder } }))
    );
    return res.status(200).json({ success: true, message: 'Order saved' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
  }
});

/**
 * PUT /api/team/:id/portfolio
 * Replace the media credited to this member. Body: { items: [{ mediaId, role }] }
 */
router.put('/:id/portfolio', ...adminOnly, validate(z.object({
  items: z.array(z.object({ mediaId: z.string(), role: z.string().max(80).nullable().optional() })).max(500)
})), async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'Not Found', message: 'Team member not found' });
    }

    const items = [...new Map(req.body.items.map(i => [i.mediaId, i])).values()];
    await prisma.$transaction(async (tx) => {
      await tx.mediaCredit.deleteMany({ where: { userId } });
      for (const item of items) {
        await tx.mediaCredit.create({ data: { userId, mediaId: item.mediaId, role: item.role || null } });
      }
    });

    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      action: 'UPDATE_PORTFOLIO',
      entityType: 'User',
      entityId: userId,
      details: `Set ${items.length} portfolio item(s) for ${user.name}`
    });

    return res.status(200).json({ success: true, message: 'Portfolio saved', count: items.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
  }
});

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
 * Create a team member profile. Members created here have no password and
 * cannot log in; they exist to be shown on the site.
 */
router.post('/', ...adminOnly, validate(profileSchema), async (req, res) => {
  try {
    const data = profileData(req.body);
    const base = req.body.slug || slugify(req.body.name);
    data.slug = await uniqueUserSlug(base);
    data.email = `${data.slug}.${Date.now()}@members.dsa.local`;
    data.password = null;

    const created = await prisma.user.create({ data, include: { role: true } });

    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      action: 'CREATE_MEMBER',
      entityType: 'User',
      entityId: created.id,
      details: `Created team profile for ${created.name}`
    });

    const profile = formatProfile(created);
    return res.status(201).json({ success: true, message: 'Member created', data: profile, member: profile });
  } catch (err) {
    console.error('Create member error:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
  }
});

/**
 * PUT|PATCH /api/team/:id
 * Update a member's public profile
 */
router.route('/:id').put(...adminOnly, validate(profileUpdateSchema), updateMember)
  .patch(...adminOnly, validate(profileUpdateSchema), updateMember);

async function updateMember(req, res) {
  try {
    const { id } = req.params;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Not Found', message: 'Team member not found' });
    }

    const data = profileData(req.body);
    if (req.body.slug !== undefined) {
      data.slug = await uniqueUserSlug(req.body.slug, id);
    } else if (!existing.slug) {
      data.slug = await uniqueUserSlug(slugify(data.name || existing.name), id);
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      include: { role: true, _count: { select: { mediaCredits: true } } }
    });

    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      action: 'UPDATE_MEMBER',
      entityType: 'User',
      entityId: id,
      details: `Updated team profile for ${updated.name}`
    });

    const profile = formatProfile(updated);
    return res.status(200).json({ success: true, message: 'Member updated', data: profile, member: profile });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
  }
}

/**
 * DELETE /api/team/:id
 * Delete a member profile. Login accounts (members with a password) can't be
 * deleted here; hide them instead.
 */
router.delete('/:id', ...adminOnly, async (req, res) => {
  try {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Not Found', message: 'Team member not found' });
    }
    if (existing.password) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'This member has a login account. Hide them from the site instead of deleting.'
      });
    }

    await prisma.user.delete({ where: { id: existing.id } });

    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      action: 'DELETE_MEMBER',
      entityType: 'User',
      entityId: existing.id,
      details: `Deleted team profile for ${existing.name}`
    });

    return res.status(200).json({ success: true, message: 'Member removed' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;

