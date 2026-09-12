const router = require("express").Router();
const path = require("path");
const fs = require("fs");

// Simple local file system - no database required
const UPLOAD_DIR = path.join(__dirname, '../uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Get all files
router.get("/files", (req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    const mediaFiles = files.filter(f => 
      /\.(jpg|jpeg|png|gif|webp|mp4|mov|webm)$/i.test(f)
    );
    
    const fileData = mediaFiles.map(filename => {
      const filePath = path.join(UPLOAD_DIR, filename);
      const stats = fs.statSync(filePath);
      const isVideo = /\.(mp4|mov|webm)$/i.test(filename);
      
      return {
        id: filename,
        title: filename,
        imageUrl: `/media/${filename}`,
        type: isVideo ? 'video' : 'image',
        uploadedAt: stats.mtime,
        size: stats.size
      };
    }).sort((a, b) => b.uploadedAt - a.uploadedAt);
    
    res.json({ files: fileData });
  } catch (error) {
    console.error('Error reading files:', error);
    res.json({ files: [] });
  }
});

// Upload file
router.post("/upload", (req, res) => {
  // This is a placeholder - actual upload handled by multer in photoRoutes
  res.json({ message: "Use /api/photos for uploads" });
});

// Delete file
router.delete("/files/:filename", (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(UPLOAD_DIR, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ message: "File deleted" });
    } else {
      res.status(404).json({ error: "File not found" });
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

module.exports = router;
