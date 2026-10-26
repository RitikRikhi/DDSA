const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { z } = require('zod');
const prisma = require('../config/prisma');
const { optionalAuth, authenticate, requireRoles, normalizeRole } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validation');
const { logActivity } = require('../utils/activityLogger');
const { createNotification } = require('../utils/notificationHelper');
const { IMAGE_EXTS, VIDEO_EXTS, uploadsDir, storeUpload, deleteStoredFile } = require('../utils/mediaProcessor');

// Only admins manage site content
const adminOnly = [authenticate, requireRoles('ADMIN')];

// "site" holds internal assets (event covers, video posters, avatars) that no public gallery lists
const CATEGORIES = ['photography', 'videography', 'editing', 'achievements', 'reels', 'team-bts', 'archives', 'sports', 'site'];
const MAX_FILES = 20;

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E6);
    cb(null, `${cleanName}-${uniqueSuffix}${ext}`);
  }
});

// File filter for supported formats: JPG, PNG, WEBP, MP4, MOV, WEBM
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if ([...IMAGE_EXTS, ...VIDEO_EXTS].includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${ext || 'unknown'}. Supported types are JPG, PNG, WEBP, MP4, MOV, WEBM.`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: MAX_FILES
  }
});

// Wrap multer so its errors come back as 400 JSON instead of a 500
const receiveFiles = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'File is larger than the 100 MB limit'
      : err.code === 'LIMIT_FILE_COUNT'
        ? `You can upload up to ${MAX_FILES} files at once`
        : err.message;
    return res.status(400).json({ success: false, error: 'Validation Error', message });
  });
};

const parseJsonArray = (value) => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : (value || []);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    return value ? [value] : [];
  }
};

const isAdminUser = (user) => {
  if (!user) return false;
  const role = normalizeRole(user.role);
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
};

const mediaInclude = {
  event: true,
  uploadedBy: true,
  credits: { include: { user: { select: { id: true, name: true } } } }
};

/**
 * Format media asset for frontend response
 */
function formatMedia(m) {
  const title = m.title || m.fileName.replace(/[-_]/g, ' ').replace(/\.[^/.]+$/, '');
  return {
    id: m.id,
    fileName: m.fileName,
    name: m.fileName, // alias
    title,
    description: m.description || null,
    fileUrl: m.fileUrl,
    url: m.fileUrl, // alias
    thumbnailUrl: m.thumbnailUrl || m.posterUrl || m.fileUrl,
    posterUrl: m.posterUrl || null,
    type: m.type || 'image',
    size: m.size || null,
    sizeBytes: m.sizeBytes,
    res: m.res || null,
    width: m.width || null,
    height: m.height || null,
    durationSec: m.durationSec || null,
    category: m.category || 'photography',
    subcategory: m.subcategory || null,
    tags: parseJsonArray(m.tags),
    exif: m.exif || null,
    eventName: m.event?.title || m.event?.name || null,
    eventId: m.eventId,
    uploadedBy: m.uploadedBy?.name || null,
    uploadedById: m.uploadedById,
    credits: (m.credits || []).map(c => ({ userId: c.userId, name: c.user?.name, role: c.role })),
    isFeatured: m.isFeatured,
    isPublished: m.isPublished,
    sortOrder: m.sortOrder,
    storage: m.storage,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt
  };
}

/**
 * GET /api/media, /api/photos, /api/upload/files, /api/media/files
 * Fetch gallery items with filters. Drafts are only returned to admins
 * who ask for them with ?status=all|draft.
 */
router.get(['/', '/gallery', '/files'], optionalAuth, async (req, res) => {
  try {
    const { category, subcategory, eventId, type, search, featured, status, page = 1, limit = 50, sort = 'custom' } = req.query;

    const where = {};
    if (category && category !== 'all') {
      where.category = category.toLowerCase();
    }
    if (subcategory && subcategory !== 'all') {
      where.subcategory = subcategory.toLowerCase();
    }
    if (eventId) {
      where.eventId = eventId === 'none' ? null : eventId;
    }
    if (type && type !== 'all') {
      where.type = type.toLowerCase();
    }
    if (featured === 'true') {
      where.isFeatured = true;
    }
    if (search) {
      where.OR = [
        { fileName: { contains: search } },
        { title: { contains: search } },
        { category: { contains: search } },
        { tags: { contains: search } }
      ];
    }

    if (isAdminUser(req.user) && (status === 'all' || status === 'draft')) {
      if (status === 'draft') where.isPublished = false;
    } else {
      where.isPublished = true;
    }

    const take = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const orderBy = sort === 'oldest'
      ? [{ createdAt: 'asc' }]
      : sort === 'newest'
        ? [{ createdAt: 'desc' }]
        : [{ sortOrder: 'asc' }, { createdAt: 'desc' }];

    const [assets, total] = await Promise.all([
      prisma.mediaAsset.findMany({ where, skip, take, orderBy, include: mediaInclude }),
      prisma.mediaAsset.count({ where })
    ]);

    const formatted = assets.map(formatMedia);

    return res.status(200).json({
      success: true,
      data: formatted,
      files: formatted,
      photos: formatted,
      total,
      page: parseInt(page) || 1,
      totalPages: Math.ceil(total / take)
    });
  } catch (err) {
    console.error('Fetch media error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message
    });
  }
});

/**
 * GET /api/media/:id
 * Retrieve single media item
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const media = await prisma.mediaAsset.findFirst({
      where: {
        OR: [
          { id: req.params.id },
          { fileName: req.params.id }
        ]
      },
      include: mediaInclude
    });

    if (!media || (!media.isPublished && !isAdminUser(req.user))) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Media item not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: formatMedia(media),
      file: formatMedia(media)
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
 * POST /api/media/upload or /api/upload or /api/photos
 * Upload one or more media files (admins only).
 * Body fields apply to every file: category, subcategory, eventId, title,
 * description, tags, publish ("true"/"false"), featured.
 */
router.post(['/upload', '/', '/files'], ...adminOnly, receiveFiles, async (req, res) => {
  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'No media file provided'
    });
  }

  const cleanupAll = () => files.forEach(f => fs.promises.unlink(f.path).catch(() => {}));

  const category = (req.body.category || '').toLowerCase();
  if (category && !CATEGORIES.includes(category)) {
    cleanupAll();
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: `Unknown category "${category}". Use one of: ${CATEGORIES.join(', ')}`
    });
  }

  let eventId = req.body.eventId || null;
  if (eventId) {
    const ev = await prisma.event.findUnique({ where: { id: eventId } });
    if (!ev) {
      cleanupAll();
      return res.status(400).json({ success: false, error: 'Validation Error', message: 'Event not found' });
    }
  }

  const tags = req.body.tags
    ? (Array.isArray(req.body.tags) ? req.body.tags : String(req.body.tags).split(',').map(s => s.trim()).filter(Boolean))
    : [];
  const isPublished = req.body.publish === undefined ? true : String(req.body.publish) === 'true';
  const isFeatured = String(req.body.featured) === 'true';

  const created = [];
  const failed = [];

  for (const file of files) {
    let stored = null;
    try {
      const isVideo = VIDEO_EXTS.includes(path.extname(file.originalname).toLowerCase());
      const fileCategory = category || (isVideo ? 'videography' : 'photography');
      stored = await storeUpload(file, { category: fileCategory });

      const asset = await prisma.mediaAsset.create({
        data: {
          ...stored,
          fileName: file.originalname,
          title: files.length === 1 && req.body.title ? req.body.title : null,
          description: req.body.description || null,
          category: fileCategory,
          subcategory: req.body.subcategory ? req.body.subcategory.toLowerCase() : null,
          tags: JSON.stringify(tags),
          exif: req.body.exif || null,
          isPublished,
          isFeatured,
          eventId: eventId || undefined,
          uploadedById: req.user.id
        },
        include: mediaInclude
      });
      created.push(formatMedia(asset));
    } catch (err) {
      console.error(`Upload error for ${file.originalname}:`, err);
      fs.promises.unlink(file.path).catch(() => {});
      // Stored but not recorded: remove the stored copy and thumbnail too
      if (stored) await deleteStoredFile(stored);
      failed.push({ fileName: file.originalname, message: err.message });
    }
  }

  if (created.length > 0) {
    await createNotification({
      title: 'Media Uploaded',
      message: `${created.length} file(s) added to ${category || 'the media library'}`,
      type: 'media'
    });

    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      action: 'UPLOAD_MEDIA',
      entityType: 'MediaAsset',
      entityId: created[0].id,
      details: `Uploaded ${created.map(c => c.fileName).join(', ')}`
    });
  }

  if (created.length === 0) {
    return res.status(500).json({
      success: false,
      error: 'Upload Error',
      message: failed[0]?.message || 'Upload failed',
      failed
    });
  }

  return res.status(201).json({
    success: true,
    message: failed.length ? `${created.length} uploaded, ${failed.length} failed` : 'Media uploaded and processed successfully',
    data: created.length === 1 ? created[0] : created,
    file: created[0],
    files: created,
    failed
  });
});

const mediaUpdateSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z.enum(CATEGORIES).optional(),
  subcategory: z.string().max(50).nullable().optional(),
  tags: z.array(z.string()).optional(),
  exif: z.string().max(200).nullable().optional(),
  eventId: z.string().nullable().optional(),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  posterUrl: z.string().nullable().optional(),
  credits: z.array(z.object({
    userId: z.string().min(1),
    role: z.string().max(80).nullable().optional()
  })).optional()
});

const bulkSchema = z.object({
  ids: z.array(z.string()).min(1).max(500),
  action: z.enum(['publish', 'unpublish', 'feature', 'unfeature', 'move', 'delete']),
  category: z.enum(CATEGORIES).optional(),
  eventId: z.string().nullable().optional()
});

const reorderSchema = z.object({
  items: z.array(z.object({ id: z.string(), sortOrder: z.number().int() })).min(1).max(1000)
});

/**
 * PATCH /api/media/reorder
 * Body: { items: [{ id, sortOrder }] }
 */
router.patch('/reorder', ...adminOnly, validate(reorderSchema), async (req, res) => {
  try {
    await prisma.$transaction(
      req.body.items.map(({ id, sortOrder }) => prisma.mediaAsset.update({ where: { id }, data: { sortOrder } }))
    );
    return res.status(200).json({ success: true, message: 'Order saved' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
  }
});

/**
 * PATCH /api/media/bulk
 * Body: { ids, action: publish|unpublish|feature|unfeature|move|delete, category?, eventId? }
 */
router.patch('/bulk', ...adminOnly, validate(bulkSchema), async (req, res) => {
  try {
    const { ids, action, category, eventId } = req.body;

    if (action === 'delete') {
      const assets = await prisma.mediaAsset.findMany({ where: { id: { in: ids } } });
      await prisma.mediaAsset.deleteMany({ where: { id: { in: ids } } });
      await prisma.event.updateMany({ where: { heroVideoId: { in: ids } }, data: { heroVideoId: null } });
      for (const asset of assets) {
        await removeFileIfUnused(asset);
      }
    } else {
      const data = {
        publish: { isPublished: true },
        unpublish: { isPublished: false },
        feature: { isFeatured: true },
        unfeature: { isFeatured: false },
        move: {
          ...(category ? { category } : {}),
          ...(eventId !== undefined ? { eventId } : {})
        }
      }[action];
      await prisma.mediaAsset.updateMany({ where: { id: { in: ids } }, data });
    }

    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      action: `BULK_${action.toUpperCase()}_MEDIA`,
      entityType: 'MediaAsset',
      entityId: ids[0],
      details: `${action} on ${ids.length} media item(s)`
    });

    return res.status(200).json({ success: true, message: `${action} applied to ${ids.length} item(s)` });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
  }
});

/**
 * PATCH /api/media/:id
 * Edit title, category, event, publish state, credits, ...
 */
router.patch('/:id', ...adminOnly, validate(mediaUpdateSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Not Found', message: 'Media item not found' });
    }

    const { credits, tags, ...fields } = req.body;
    const data = { ...fields };
    if (tags) data.tags = JSON.stringify(tags);
    // A custom poster replaces the video's thumbnail too
    if (existing.type === 'video' && fields.posterUrl !== undefined) {
      data.thumbnailUrl = fields.posterUrl;
    }

    await prisma.$transaction(async (tx) => {
      await tx.mediaAsset.update({ where: { id }, data });
      if (credits) {
        await tx.mediaCredit.deleteMany({ where: { mediaId: id } });
        const unique = [...new Map(credits.map(c => [c.userId, c])).values()];
        for (const c of unique) {
          await tx.mediaCredit.create({ data: { mediaId: id, userId: c.userId, role: c.role || null } });
        }
      }
    });

    const updated = await prisma.mediaAsset.findUnique({ where: { id }, include: mediaInclude });

    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      action: 'UPDATE_MEDIA',
      entityType: 'MediaAsset',
      entityId: id,
      details: `Updated media ${updated.title || updated.fileName}`
    });

    return res.status(200).json({ success: true, message: 'Media updated', data: formatMedia(updated) });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal Server Error', message: err.message });
  }
});

// Delete the stored file unless another row still points at the same URL
// (seeded rows share files).
async function removeFileIfUnused(asset) {
  const stillUsed = await prisma.mediaAsset.count({ where: { fileUrl: asset.fileUrl } });
  if (stillUsed === 0) {
    await deleteStoredFile(asset);
  }
}

/**
 * DELETE /api/media/:id or /api/upload/files/:id
 * Delete media asset and its stored file
 */
router.delete(['/:id', '/files/:id'], ...adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.mediaAsset.findFirst({
      where: {
        OR: [
          { id },
          { fileName: id }
        ]
      }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Media item not found'
      });
    }

    await prisma.mediaAsset.delete({ where: { id: existing.id } });
    await removeFileIfUnused(existing);

    // Clear references that pointed at this asset
    await prisma.event.updateMany({ where: { heroVideoId: existing.id }, data: { heroVideoId: null } });

    await logActivity({
      userId: req.user.id,
      userName: req.user.name,
      action: 'DELETE_MEDIA',
      entityType: 'MediaAsset',
      entityId: existing.id,
      details: `Deleted media asset ${existing.fileName}`
    });

    return res.status(200).json({
      success: true,
      message: 'Media item deleted successfully'
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
module.exports.formatMedia = formatMedia;
