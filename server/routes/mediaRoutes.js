const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../config/prisma');
const { optionalAuth, authenticate, requireRoles } = require('../middleware/authMiddleware');
const { logActivity } = require('../utils/activityLogger');
const { createNotification } = require('../utils/notificationHelper');
const { cloudinary } = require('../config/cloudinary');

// Ensure upload directories exist
const uploadsDir = path.resolve(__dirname, '../uploads');
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

// File filter for supported formats: JPG, PNG, WEBP, MP4, MOV
const fileFilter = (req, file, cb) => {
  const allowedExts = /jpeg|jpg|png|webp|mp4|mov|webm|quicktime/i;
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  if (allowedExts.test(ext) || allowedExts.test(mime)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${ext}. Supported types are JPG, PNG, WEBP, MP4, MOV.`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

/**
 * Format media asset for frontend response
 */
function formatMedia(m) {
  let tags = [];
  try {
    tags = typeof m.tags === 'string' ? JSON.parse(m.tags || '[]') : (m.tags || []);
  } catch (e) {
    tags = m.tags ? [m.tags] : [];
  }

  return {
    id: m.id,
    fileName: m.fileName,
    name: m.fileName, // alias
    title: m.fileName.replace(/[-_]/g, ' ').replace(/\.[^/.]+$/, ''),
    fileUrl: m.fileUrl,
    url: m.fileUrl, // alias
    thumbnailUrl: m.thumbnailUrl || m.fileUrl,
    type: m.type || 'image',
    size: m.size || '10.5 MB',
    sizeBytes: m.sizeBytes,
    res: m.res || (m.type === 'video' ? '4K 60fps' : '3840 x 2160'),
    category: m.category || 'photography',
    tags,
    exif: m.exif || 'Sony A7 IV · 24mm · f/2.8 · 1/800s · ISO 100',
    eventName: m.event?.title || m.event?.name || 'DSA Showcase',
    eventId: m.eventId,
    uploadedBy: m.uploadedBy?.name || 'Crew Member',
    uploadedById: m.uploadedById,
    isFeatured: m.isFeatured,
    createdAt: m.createdAt
  };
}

/**
 * GET /api/media, /api/photos, /api/upload/files, /api/media/files
 * Fetch gallery items with filters
 */
router.get(['/', '/gallery', '/files'], async (req, res) => {
  try {
    const { category, eventId, type, search, page = 1, limit = 50, sort = 'newest' } = req.query;

    const where = {};
    if (category && category !== 'all') {
      where.category = category.toLowerCase();
    }
    if (eventId) {
      where.eventId = eventId;
    }
    if (type && type !== 'all') {
      where.type = type.toLowerCase();
    }
    if (search) {
      where.OR = [
        { fileName: { contains: search } },
        { category: { contains: search } },
        { tags: { contains: search } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [assets, total] = await Promise.all([
      prisma.mediaAsset.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: sort === 'oldest' ? 'asc' : 'desc' },
        include: {
          event: true,
          uploadedBy: true
        }
      }),
      prisma.mediaAsset.count({ where })
    ]);

    const formatted = assets.map(formatMedia);

    return res.status(200).json({
      success: true,
      data: formatted,
      files: formatted,
      photos: formatted,
      total,
      page: parseInt(page),
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
router.get('/:id', async (req, res) => {
  try {
    const media = await prisma.mediaAsset.findFirst({
      where: {
        OR: [
          { id: req.params.id },
          { fileName: req.params.id }
        ]
      },
      include: {
        event: true,
        uploadedBy: true
      }
    });

    if (!media) {
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
 * Upload media file (image or video) with any field name
 */
router.post(['/upload', '/', '/files'], optionalAuth, upload.any(), async (req, res) => {
  try {
    const file = req.files && req.files.length > 0 ? req.files[0] : req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'No media file provided'
      });
    }

    const isVideo = file.mimetype.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file.originalname);
    const category = (req.body.category || (isVideo ? 'videography' : 'photography')).toLowerCase();
    const eventId = req.body.eventId || null;
    const eventName = req.body.eventName || req.body.event || null;
    const exif = req.body.exif || (isVideo ? 'Sony FX3 · 4K UHD 60fps · S-Log3' : 'Sony A7 IV · 35mm · f/1.8 · 1/1000s · ISO 100');
    const tags = req.body.tags ? (Array.isArray(req.body.tags) ? req.body.tags : req.body.tags.split(',').map(s => s.trim())) : [category, isVideo ? 'Cinematics' : 'Editorial'];

    let fileUrl = `/media/${file.filename}`;
    let sizeHuman = (file.size / (1024 * 1024)).toFixed(1) + ' MB';

    // Cloudinary upload if configured
    if (cloudinary && process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
      try {
        const cloudRes = await cloudinary.uploader.upload(file.path, {
          resource_type: isVideo ? 'video' : 'image',
          folder: `dsa_media/${category}`
        });
        if (cloudRes && cloudRes.secure_url) {
          fileUrl = cloudRes.secure_url;
        }
      } catch (cloudErr) {
        console.warn('Cloudinary upload notice (fallback to local server URL):', cloudErr.message);
      }
    }

    // Resolve event if eventName is given
    let resolvedEventId = eventId;
    if (!resolvedEventId && eventName) {
      const ev = await prisma.event.findFirst({
        where: {
          OR: [
            { title: { contains: eventName } },
            { name: { contains: eventName } }
          ]
        }
      });
      if (ev) resolvedEventId = ev.id;
    }

    // Create database record
    const asset = await prisma.mediaAsset.create({
      data: {
        fileName: file.originalname,
        fileUrl,
        thumbnailUrl: fileUrl,
        type: isVideo ? 'video' : 'image',
        size: sizeHuman,
        sizeBytes: file.size,
        res: isVideo ? '4K 60fps' : '3840 x 2160',
        category,
        tags: JSON.stringify(tags),
        exif,
        eventId: resolvedEventId || undefined,
        uploadedById: req.user?.id || null
      },
      include: { event: true, uploadedBy: true }
    });

    // Notify & log
    await createNotification({
      title: 'Media Asset Uploaded',
      message: `New ${isVideo ? 'video' : 'photo'} "${file.originalname}" added to ${category}`,
      type: 'media'
    });

    await logActivity({
      userId: req.user?.id || null,
      userName: req.user?.name || 'Creator',
      action: 'UPLOAD_MEDIA',
      entityType: 'MediaAsset',
      entityId: asset.id,
      details: `Uploaded ${file.originalname} (${sizeHuman})`
    });

    return res.status(201).json({
      success: true,
      message: 'Media uploaded and processed successfully',
      data: formatMedia(asset),
      file: formatMedia(asset)
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({
      success: false,
      error: 'Upload Error',
      message: err.message
    });
  }
});

/**
 * DELETE /api/media/:id or /api/upload/files/:id
 * Delete media asset by ID or filename
 */
router.delete(['/:id', '/files/:id'], authenticate, requireRoles('SUPER_ADMIN', 'ADMIN', 'TECHNICAL_HEAD'), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.mediaAsset.findFirst({
      where: {
        OR: [
          { id },
          { fileName: id },
          { fileUrl: { contains: id } }
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
