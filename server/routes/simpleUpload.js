const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Metadata storage file
const metadataFile = path.join(__dirname, '../uploads/metadata.json');

// Load metadata
function loadMetadata() {
  try {
    if (fs.existsSync(metadataFile)) {
      const data = fs.readFileSync(metadataFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading metadata:', err);
  }
  return {};
}

// Save metadata
function saveMetadata(metadata) {
  try {
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
  } catch (err) {
    console.error('Error saving metadata:', err);
  }
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Upload endpoint
router.post('/', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const url = `/media/${req.file.filename}`;
    console.log('Upload response URL:', url);
    
    // Save metadata
    const metadata = loadMetadata();
    metadata[req.file.filename] = {
      title: req.body.title || req.file.originalname,
      eventName: req.body.eventName || '',
      description: req.body.description || '',
      category: req.body.category || 'general',
      uploadedAt: new Date().toISOString()
    };
    saveMetadata(metadata);
    
    res.json({
      success: true,
      filename: req.file.filename,
      originalname: req.file.originalname,
      url: url,
      size: req.file.size,
      title: req.body.title || req.file.originalname,
      eventName: req.body.eventName || '',
      description: req.body.description || '',
      category: req.body.category || 'general'
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// List files endpoint
router.get('/files', (req, res) => {
  try {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      return res.json({ files: [] });
    }
    
    const files = fs.readdirSync(uploadDir);
    const mediaFiles = files.filter(f => 
      /\.(jpg|jpeg|png|gif|webp|mp4|mov|webm)$/i.test(f) && f !== 'metadata.json'
    );
    
    const metadata = loadMetadata();
    
    const fileData = mediaFiles.map(filename => {
      const filePath = path.join(uploadDir, filename);
      const stats = fs.statSync(filePath);
      const isVideo = /\.(mp4|mov|webm)$/i.test(filename);
      const fileMetadata = metadata[filename] || {};
      
      // Read file as base64 for admin portal reliability
      let base64Data = null;
      let mimeType = 'image/jpeg';
      try {
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp'
        };
        mimeType = mimeTypes[ext] || 'image/jpeg';
        
        if (!isVideo) { // Generate base64 for all images (no size limit for now)
          const fileBuffer = fs.readFileSync(filePath);
          base64Data = fileBuffer.toString('base64');
          console.log('Generated base64 for:', filename, 'Size:', stats.size, 'Base64 length:', base64Data.length);
        } else {
          console.log('Skipped base64 for video:', filename);
        }
      } catch (err) {
        console.log('Could not read file as base64:', filename, err);
      }
      
      return {
        filename: filename,
        url: `/media/${filename}`,
        base64: base64Data,
        mimeType: mimeType,
        size: stats.size,
        uploadedAt: stats.mtime,
        type: isVideo ? 'video' : 'image',
        title: fileMetadata.title || filename,
        eventName: fileMetadata.eventName || '',
        description: fileMetadata.description || '',
        category: fileMetadata.category || 'general'
      };
    }).sort((a, b) => b.uploadedAt - a.uploadedAt);
    
    res.json({ files: fileData });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Delete file endpoint
router.delete('/files/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../uploads', filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      
      // Remove metadata
      const metadata = loadMetadata();
      if (metadata[filename]) {
        delete metadata[filename];
        saveMetadata(metadata);
      }
      
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
