const router = require("express").Router();
const mongoose = require("mongoose");
const TeamMember = require("../models/TeamMember");
const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { apiCache, clearApiCache } = require("../middleware/apiCache");

// File storage configuration for team assets (avatars, banners, proof-of-work files)
const teamStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/team');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const prefix = file.fieldname === 'bannerImage' || file.fieldname === 'overlayImage' ? 'banner-' :
                   file.fieldname === 'thumbnailFile' ? 'thumb-' :
                   file.fieldname === 'photoFile' ? 'work-' : 'avatar-';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
  }
});

const teamUpload = multer({ 
  storage: teamStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit for high-res banners/works
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new AppError('Only image and video files are allowed', 400), false);
    }
  }
});

const teamUploadFields = teamUpload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'avatar', maxCount: 1 },
  { name: 'bannerImage', maxCount: 1 },
  { name: 'overlayImage', maxCount: 1 },
  { name: 'photoFile', maxCount: 1 },
  { name: 'thumbnailFile', maxCount: 1 }
]);

// Helper: load local team.json
function loadLocalTeam() {
  const filePath = path.join(__dirname, '../data/team.json');
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data || '[]');
    } catch (e) {
      console.error("Error reading team.json:", e.message);
      return [];
    }
  }
  return [];
}

// Helper: save local team.json
function saveLocalTeam(teamList) {
  const filePath = path.join(__dirname, '../data/team.json');
  try {
    fs.writeFileSync(filePath, JSON.stringify(teamList, null, 2), 'utf8');
    clearApiCache('/api/team');
    return true;
  } catch (e) {
    console.error("Error writing team.json:", e.message);
    return false;
  }
}

// ============================================
// 1. GET ALL TEAM MEMBERS / CREATORS
// ============================================
router.get("/", apiCache(60), async (req, res) => {
  let teamMembers = [];
  
  if (mongoose.connection.readyState === 1) {
    try {
      teamMembers = await TeamMember.find({ isActive: true }).sort({ joinedAt: -1 });
    } catch (e) {
      teamMembers = [];
    }
  }

  if (!teamMembers || teamMembers.length === 0) {
    teamMembers = loadLocalTeam();
  }
  
  res.json(teamMembers);
});

// ============================================
// 2. GET SINGLE CREATOR BY ID
// ============================================
router.get("/:id", apiCache(60), async (req, res, next) => {
  const id = req.params.id;

  if (mongoose.connection.readyState === 1) {
    try {
      const member = await TeamMember.findOne({ $or: [{ _id: mongoose.isValidObjectId(id) ? id : null }, { id: id }] });
      if (member) return res.json(member);
    } catch (e) {}
  }

  const list = loadLocalTeam();
  const found = list.find(m => m.id === id || m._id === id);
  if (found) return res.json(found);

  return next(new AppError("Team member not found", 404));
});

// ============================================
// 3. CREATE NEW CREATOR
// ============================================
router.post("/", teamUploadFields, catchAsync(async (req, res, next) => {
  const body = req.body;
  const files = req.files || {};

  if (!body.name) {
    return next(new AppError("Creator name is required", 400));
  }

  let skills = [];
  if (body.skills) {
    try {
      skills = typeof body.skills === 'string' ? (body.skills.startsWith('[') ? JSON.parse(body.skills) : body.skills.split(',').map(s => s.trim()).filter(Boolean)) : body.skills;
    } catch (e) {
      skills = body.skills.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  let credits = [];
  if (body.credits) {
    try {
      credits = typeof body.credits === 'string' ? (body.credits.startsWith('[') ? JSON.parse(body.credits) : body.credits.split(',').map(s => s.trim()).filter(Boolean)) : body.credits;
    } catch (e) {
      credits = body.credits.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  let mediaDNA = { storytelling: 90, cinematography: 90, editing: 90, creativity: 90, leadership: 90 };
  if (body.mediaDNA) {
    try {
      mediaDNA = typeof body.mediaDNA === 'string' ? JSON.parse(body.mediaDNA) : body.mediaDNA;
    } catch (e) {}
  }

  let socials = {
    instagram: body.instagram || body['socials.instagram'] || 'https://instagram.com/dsamediacrew',
    linkedin: body.linkedin || body['socials.linkedin'] || '',
    youtube: body.youtube || body['socials.youtube'] || '',
    behance: body.behance || body['socials.behance'] || '',
    github: body.github || body['socials.github'] || '',
    portfolio: body.portfolio || body['socials.portfolio'] || ''
  };
  if (body.socials && typeof body.socials === 'string' && body.socials.startsWith('{')) {
    try { socials = JSON.parse(body.socials); } catch (e) {}
  }

  let portfolio = { photos: [], videos: [] };
  if (body.portfolio) {
    try {
      portfolio = typeof body.portfolio === 'string' ? JSON.parse(body.portfolio) : body.portfolio;
    } catch (e) {}
  }

  let artwork = [];
  if (body.artwork) {
    try {
      artwork = typeof body.artwork === 'string' ? JSON.parse(body.artwork) : body.artwork;
    } catch (e) {}
  }

  // Handle uploaded files
  let imageUrl = body.image || body.avatar || body.fallbackImage || '';
  if (files.image && files.image[0]) {
    imageUrl = `/server/uploads/team/${files.image[0].filename}`;
  } else if (files.avatar && files.avatar[0]) {
    imageUrl = `/server/uploads/team/${files.avatar[0].filename}`;
  }

  let bannerImageUrl = body.bannerImage || body.overlayImage || '';
  if (files.bannerImage && files.bannerImage[0]) {
    bannerImageUrl = `/server/uploads/team/${files.bannerImage[0].filename}`;
  } else if (files.overlayImage && files.overlayImage[0]) {
    bannerImageUrl = `/server/uploads/team/${files.overlayImage[0].filename}`;
  }

  const creatorId = body.id || (body.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now().toString().slice(-4));

  const newCreator = {
    id: creatorId,
    _id: creatorId,
    name: body.name.trim(),
    role: body.role ? body.role.trim() : 'Creator',
    category: body.category ? body.category.toLowerCase().trim() : 'photography',
    image: imageUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=1000&fit=crop&crop=face',
    fallbackImage: imageUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=1000&fit=crop&crop=face',
    bannerImage: bannerImageUrl || imageUrl || '',
    overlayImage: bannerImageUrl || imageUrl || '',
    bio: body.bio ? body.bio.trim() : 'Passionate creator at DSA Media Crew, bringing visual stories to life.',
    tagline: body.tagline ? body.tagline.trim() : '',
    specialty: body.specialty ? body.specialty.trim() : '',
    email: body.email ? body.email.trim() : `${creatorId}@dsa.com`,
    phone: body.phone ? body.phone.trim() : '',
    skills: skills.length > 0 ? skills : ['Visual Arts', 'Creative Production'],
    mediaDNA: mediaDNA,
    credits: credits,
    socials: socials,
    socialLinks: socials,
    portfolio: portfolio,
    artwork: artwork,
    isActive: true,
    joinedAt: new Date().toISOString()
  };

  // 1. Save to local JSON
  const teamList = loadLocalTeam();
  teamList.unshift(newCreator);
  saveLocalTeam(teamList);

  // 2. Save to MongoDB if connected
  if (mongoose.connection.readyState === 1) {
    try {
      const dbMember = new TeamMember(newCreator);
      await dbMember.save();
    } catch (dbErr) {
      console.warn("MongoDB member save skipped:", dbErr.message);
    }
  }

  res.status(201).json({
    success: true,
    message: "Creator created successfully",
    creator: newCreator
  });
}));

// ============================================
// 4. UPDATE CREATOR
// ============================================
router.put("/:id", teamUploadFields, catchAsync(async (req, res, next) => {
  const id = req.params.id;
  const body = req.body;
  const files = req.files || {};

  const teamList = loadLocalTeam();
  const index = teamList.findIndex(m => m.id === id || m._id === id);

  if (index === -1) {
    return next(new AppError("Creator not found", 404));
  }

  const existing = teamList[index];

  if (body.skills) {
    try {
      existing.skills = typeof body.skills === 'string' ? (body.skills.startsWith('[') ? JSON.parse(body.skills) : body.skills.split(',').map(s => s.trim()).filter(Boolean)) : body.skills;
    } catch (e) {
      existing.skills = body.skills.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  if (body.credits) {
    try {
      existing.credits = typeof body.credits === 'string' ? (body.credits.startsWith('[') ? JSON.parse(body.credits) : body.credits.split(',').map(s => s.trim()).filter(Boolean)) : body.credits;
    } catch (e) {
      existing.credits = body.credits.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  if (body.mediaDNA) {
    try {
      existing.mediaDNA = typeof body.mediaDNA === 'string' ? JSON.parse(body.mediaDNA) : body.mediaDNA;
    } catch (e) {}
  }

  if (body.socials) {
    try {
      existing.socials = typeof body.socials === 'string' ? JSON.parse(body.socials) : body.socials;
    } catch (e) {}
  } else {
    existing.socials = {
      ...existing.socials,
      ...(body.instagram !== undefined && { instagram: body.instagram }),
      ...(body.linkedin !== undefined && { linkedin: body.linkedin }),
      ...(body.youtube !== undefined && { youtube: body.youtube }),
      ...(body.behance !== undefined && { behance: body.behance }),
      ...(body.github !== undefined && { github: body.github }),
      ...(body.portfolio !== undefined && { portfolio: body.portfolio })
    };
  }
  existing.socialLinks = existing.socials;

  if (body.portfolio) {
    try {
      existing.portfolio = typeof body.portfolio === 'string' ? JSON.parse(body.portfolio) : body.portfolio;
    } catch (e) {}
  }

  if (body.artwork) {
    try {
      existing.artwork = typeof body.artwork === 'string' ? JSON.parse(body.artwork) : body.artwork;
    } catch (e) {}
  }

  if (body.name) existing.name = body.name.trim();
  if (body.role) existing.role = body.role.trim();
  if (body.category) existing.category = body.category.toLowerCase().trim();
  if (body.bio !== undefined) existing.bio = body.bio.trim();
  if (body.tagline !== undefined) existing.tagline = body.tagline.trim();
  if (body.specialty !== undefined) existing.specialty = body.specialty.trim();
  if (body.email !== undefined) existing.email = body.email.trim();
  if (body.phone !== undefined) existing.phone = body.phone.trim();

  // File uploads
  if (files.image && files.image[0]) {
    existing.image = `/server/uploads/team/${files.image[0].filename}`;
    existing.fallbackImage = existing.image;
  } else if (body.image) {
    existing.image = body.image.trim();
    existing.fallbackImage = existing.image;
  }

  if (files.bannerImage && files.bannerImage[0]) {
    existing.bannerImage = `/server/uploads/team/${files.bannerImage[0].filename}`;
    existing.overlayImage = existing.bannerImage;
  } else if (body.bannerImage) {
    existing.bannerImage = body.bannerImage.trim();
    existing.overlayImage = existing.bannerImage;
  }

  teamList[index] = existing;
  saveLocalTeam(teamList);

  if (mongoose.connection.readyState === 1) {
    try {
      await TeamMember.findOneAndUpdate(
        { $or: [{ id: id }, { _id: mongoose.isValidObjectId(id) ? id : null }] },
        existing,
        { new: true }
      );
    } catch (e) {}
  }

  res.json({
    success: true,
    message: "Creator updated successfully",
    creator: existing
  });
}));

// ============================================
// 5. ADD PROOF OF WORK (PHOTO / VIDEO / ARTWORK)
// ============================================
router.post("/:id/proof-of-work", teamUploadFields, catchAsync(async (req, res, next) => {
  const id = req.params.id;
  const { workType, event, project, date, year, role, url, thumbnail } = req.body;
  const files = req.files || {};

  const teamList = loadLocalTeam();
  const index = teamList.findIndex(m => m.id === id || m._id === id);

  if (index === -1) {
    return next(new AppError("Creator not found", 404));
  }

  const creator = teamList[index];
  if (!creator.portfolio) creator.portfolio = { photos: [], videos: [] };
  if (!creator.artwork) creator.artwork = [];

  if (workType === 'photo') {
    let photoUrl = url || '';
    if (files.photoFile && files.photoFile[0]) {
      photoUrl = `/server/uploads/team/${files.photoFile[0].filename}`;
    }

    if (!photoUrl) {
      return next(new AppError("Photo URL or file is required", 400));
    }

    const photoItem = {
      url: photoUrl,
      event: event || project || 'Event Coverage',
      date: date || new Date().toISOString().split('T')[0],
      role: role || 'Photographer'
    };

    if (!creator.portfolio.photos) creator.portfolio.photos = [];
    creator.portfolio.photos.push(photoItem);

  } else if (workType === 'video') {
    let videoUrl = url || '';
    let thumbUrl = thumbnail || '';

    if (files.thumbnailFile && files.thumbnailFile[0]) {
      thumbUrl = `/server/uploads/team/${files.thumbnailFile[0].filename}`;
    }
    if (files.photoFile && files.photoFile[0] && !videoUrl) {
      videoUrl = `/server/uploads/team/${files.photoFile[0].filename}`;
    }

    if (!videoUrl) {
      return next(new AppError("Video URL or file is required", 400));
    }

    const videoItem = {
      url: videoUrl,
      thumbnail: thumbUrl || 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800',
      project: project || event || 'Cinematic Production',
      event: event || project || 'DSA Media Feature',
      year: year || new Date().getFullYear().toString(),
      role: role || 'Cinematographer & Editor'
    };

    if (!creator.portfolio.videos) creator.portfolio.videos = [];
    creator.portfolio.videos.push(videoItem);

  } else if (workType === 'artwork') {
    let artUrl = url || '';
    if (files.photoFile && files.photoFile[0]) {
      artUrl = `/server/uploads/team/${files.photoFile[0].filename}`;
    }

    if (!artUrl) {
      return next(new AppError("Artwork image is required", 400));
    }

    creator.artwork.push(artUrl);
  }

  teamList[index] = creator;
  saveLocalTeam(teamList);

  res.json({
    success: true,
    message: `Proof of work (${workType}) added successfully`,
    portfolio: creator.portfolio,
    artwork: creator.artwork
  });
}));

// ============================================
// 6. DELETE PROOF OF WORK ITEM
// ============================================
router.delete("/:id/proof-of-work/:type/:itemIndex", catchAsync(async (req, res, next) => {
  const { id, type, itemIndex } = req.params;
  const idx = parseInt(itemIndex, 10);

  const teamList = loadLocalTeam();
  const index = teamList.findIndex(m => m.id === id || m._id === id);

  if (index === -1) {
    return next(new AppError("Creator not found", 404));
  }

  const creator = teamList[index];

  if (type === 'photo' && creator.portfolio && creator.portfolio.photos) {
    if (idx >= 0 && idx < creator.portfolio.photos.length) {
      creator.portfolio.photos.splice(idx, 1);
    }
  } else if (type === 'video' && creator.portfolio && creator.portfolio.videos) {
    if (idx >= 0 && idx < creator.portfolio.videos.length) {
      creator.portfolio.videos.splice(idx, 1);
    }
  } else if (type === 'artwork' && creator.artwork) {
    if (idx >= 0 && idx < creator.artwork.length) {
      creator.artwork.splice(idx, 1);
    }
  }

  teamList[index] = creator;
  saveLocalTeam(teamList);

  res.json({
    success: true,
    message: "Proof of work item removed",
    portfolio: creator.portfolio,
    artwork: creator.artwork
  });
}));

// ============================================
// 7. DELETE CREATOR
// ============================================
router.delete("/:id", catchAsync(async (req, res, next) => {
  const id = req.params.id;

  const teamList = loadLocalTeam();
  const index = teamList.findIndex(m => m.id === id || m._id === id);

  if (index === -1) {
    return next(new AppError("Creator not found", 404));
  }

  const removed = teamList.splice(index, 1)[0];
  saveLocalTeam(teamList);

  [removed.image, removed.bannerImage, removed.avatar].forEach(filePath => {
    if (filePath && filePath.startsWith('/server/uploads/team/')) {
      const fullPath = path.join(__dirname, '..', filePath);
      if (fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (e) {}
      }
    }
  });

  if (mongoose.connection.readyState === 1) {
    try {
      await TeamMember.findOneAndDelete({ $or: [{ id: id }, { _id: mongoose.isValidObjectId(id) ? id : null }] });
    } catch (e) {}
  }

  res.json({
    success: true,
    message: "Creator deleted successfully"
  });
}));

module.exports = router;
