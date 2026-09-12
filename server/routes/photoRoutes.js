const router = require("express").Router();
const Photo = require("../models/Photo");
const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { cloudinary, storage } = require('../config/cloudinary');

// Local storage fallback
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: localStorage, // Use local storage as primary for reliability
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
 });

const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

// Upload a new photo/video
router.post("/", auth, upload.single("image"), catchAsync(async (req, res, next) => {
  if (!req.file) return next(new AppError("Please upload an image or video", 400));
  
  const isVideo = req.file.mimetype.startsWith('video/');
  const imageUrl = `/media/${req.file.filename}`;
  
  console.log('PhotoRoutes upload - returning URL:', imageUrl);
  
  try {
    const photo = new Photo({
      title: req.body.title,
      imageUrl: imageUrl,
      publicId: req.file.filename,
      type: isVideo ? 'video' : 'image',
      category: req.body.category || '',
      eventName: req.body.eventName || '',
      eventDate: req.body.eventDate || null,
      description: req.body.description || ''
    });
    await photo.save();
    clearApiCache('/api/photos');
    res.json(photo);
  } catch (dbError) {
    // Fallback: Return file info even if DB fails
    console.error('Database error, using fallback:', dbError);
    clearApiCache('/api/photos');
    res.json({
      _id: 'temp-' + Date.now(),
      title: req.body.title,
      imageUrl: imageUrl,
      type: isVideo ? 'video' : 'image',
      category: req.body.category || '',
      eventName: req.body.eventName || '',
      eventDate: req.body.eventDate || null,
      description: req.body.description || '',
      uploadedAt: new Date(),
      fallback: true
    });
  }
}));

const { apiCache, clearApiCache } = require("../middleware/apiCache");

// Get all photos with pagination & fast caching
router.get("/", apiCache(30), catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 1000;
  const skip = (page - 1) * limit;
  const category = req.query.category;
  const eventName = req.query.eventName;

  let photos = [];
  let total = 0;

  const mongoose = require("mongoose");
  try {
    if (mongoose.connection.readyState !== 1) {
      throw new Error("MongoDB not connected, instant fallback to local files");
    }
    let filter = {};
    if (category && category !== 'all') {
      filter.category = category;
    }
    if (eventName && eventName !== 'all') {
      filter.eventName = eventName;
    }

    photos = await Photo.find(filter)
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(limit);

    total = await Photo.countDocuments(filter);
  } catch (dbError) {
    // Fallback to local file system + metadata.json if DB fails
    const uploadDir = path.join(__dirname, '../uploads');
    const metadataPath = path.join(uploadDir, 'metadata.json');
    let metadata = {};
    if (fs.existsSync(metadataPath)) {
      try {
        metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      } catch (e) {}
    }
    
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      const imageFiles = files.filter(f => 
        /\.(jpg|jpeg|png|gif|webp|mp4|mov|webm)$/i.test(f)
      );
      
      let allLocal = imageFiles.map((filename, index) => {
        const meta = metadata[filename] || {};
        return {
          _id: `local-${index}`,
          title: meta.title || filename,
          imageUrl: `/media/${filename}`,
          type: /\.(mp4|mov|webm)$/i.test(filename) ? 'video' : 'image',
          category: meta.category || 'photography',
          eventName: meta.eventName || '',
          description: meta.description || '',
          uploadedAt: meta.uploadedAt || fs.statSync(path.join(uploadDir, filename)).mtime,
          fallback: true
        };
      });

      if (category && category !== 'all') {
        allLocal = allLocal.filter(p => p.category.toLowerCase() === category.toLowerCase());
      }
      if (eventName && eventName !== 'all') {
        allLocal = allLocal.filter(p => p.eventName.toLowerCase() === eventName.toLowerCase());
      }
      
      total = allLocal.length;
      photos = allLocal.slice(skip, skip + limit);
    }
  }

  res.json({
    photos,
    total,
    page,
    pages: Math.ceil(total / limit),
    hasMore: page * limit < total
  });
}));

// Delete a photo
router.delete("/:id", auth, catchAsync(async (req, res, next) => {
  const photo = await Photo.findById(req.params.id);
  if (!photo) {
    return next(new AppError("Photo not found", 404));
  }

  // Delete from Cloudinary if publicId exists
  if (photo.publicId) {
    const isVideo = photo.type === 'video';
    await cloudinary.uploader.destroy(photo.publicId, { 
      resource_type: isVideo ? 'video' : 'image' 
    });
  }

  // Delete from database
  await Photo.findByIdAndDelete(req.params.id);
  res.json({ msg: "Photo deleted" });
}));

module.exports = router;
