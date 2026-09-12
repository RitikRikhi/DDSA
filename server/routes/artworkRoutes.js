const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure multer for artwork uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, "../uploads/artwork");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, "artwork-" + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// POST /api/upload-artwork - Upload artwork for a member
router.post("/upload-artwork", upload.array("artwork", 10), async (req, res) => {
  try {
    const { memberId } = req.body;
    
    if (!memberId) {
      return res.status(400).json({ message: "Member ID is required" });
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }
    
    // Get the file URLs
    const artworkUrls = req.files.map(file => `/media/artwork/${file.filename}`);
    
    // Update team-data.js file
    const teamDataPath = path.join(__dirname, "../../client/js/team-data.js");
    let teamDataContent = fs.readFileSync(teamDataPath, "utf8");
    
    // Find the member and add artwork
    const memberPattern = new RegExp(`(id: '${memberId}'[^}]*portfolio:\\s*{[^}]*}[^}]*)(})`, "s");
    const artworkArray = `artwork: ${JSON.stringify(artworkUrls)}`;
    
    // Check if member already has artwork property
    const existingArtworkPattern = new RegExp(`(id: '${memberId}'[^}]*artwork:\\s*\\[[^\\]]*\\])`, "s");
    
    if (existingArtworkPattern.test(teamDataContent)) {
      // Append to existing artwork
      teamDataContent = teamDataContent.replace(existingArtworkPattern, (match) => {
        const existingMatch = match.match(/artwork:\s*(\[[^\]]*\])/);
        if (existingMatch) {
          const existingArray = JSON.parse(existingMatch[1]);
          const newArray = [...existingArray, ...artworkUrls];
          return match.replace(/artwork:\s*\[[^\]]*\]/, `artwork: ${JSON.stringify(newArray)}`);
        }
        return match;
      });
    } else {
      // Add artwork property after portfolio
      teamDataContent = teamDataContent.replace(memberPattern, `$1,\n      artwork: ${JSON.stringify(artworkUrls)}\n    }`);
    }
    
    fs.writeFileSync(teamDataPath, teamDataContent);
    
    res.json({ 
      success: true, 
      message: "Artwork uploaded successfully",
      artworkUrls 
    });
  } catch (error) {
    console.error("Error uploading artwork:", error);
    res.status(500).json({ message: "Error uploading artwork: " + error.message });
  }
});

// POST /api/delete-artwork - Delete artwork from a member
router.post("/delete-artwork", async (req, res) => {
  try {
    const { memberId, artworkIndex } = req.body;
    
    if (!memberId || artworkIndex === undefined) {
      return res.status(400).json({ message: "Member ID and artwork index are required" });
    }
    
    // Update team-data.js file
    const teamDataPath = path.join(__dirname, "../../client/js/team-data.js");
    let teamDataContent = fs.readFileSync(teamDataPath, "utf8");
    
    // Find the member and remove artwork at index
    const memberPattern = new RegExp(`(id: '${memberId}'[^}]*artwork:\\s*\\[)([^\\]]*)(\\])`, "s");
    
    teamDataContent = teamDataContent.replace(memberPattern, (match, prefix, arrayContent, suffix) => {
      const artworkArray = JSON.parse(arrayContent);
      
      if (artworkIndex >= 0 && artworkIndex < artworkArray.length) {
        const deletedUrl = artworkArray[artworkIndex];
        artworkArray.splice(artworkIndex, 1);
        
        // Delete the actual file
        const filename = path.basename(deletedUrl);
        const filePath = path.join(__dirname, "../uploads/artwork", filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      
      return `${prefix}${JSON.stringify(artworkArray)}${suffix}`;
    });
    
    fs.writeFileSync(teamDataPath, teamDataContent);
    
    res.json({ 
      success: true, 
      message: "Artwork deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting artwork:", error);
    res.status(500).json({ message: "Error deleting artwork: " + error.message });
  }
});

// GET /api/artwork/:memberId - Get artwork for a member
router.get("/artwork/:memberId", async (req, res) => {
  try {
    const { memberId } = req.params;
    
    // Read team-data.js file
    const teamDataPath = path.join(__dirname, "../../client/js/team-data.js");
    const teamDataContent = fs.readFileSync(teamDataPath, "utf8");
    
    // Find the member's artwork
    const memberPattern = new RegExp(`id: '${memberId}'[^}]*artwork:\\s*(\\[[^\\]]*\\])`, "s");
    const match = teamDataContent.match(memberPattern);
    
    if (match) {
      const artworkArray = JSON.parse(match[1]);
      res.json({ success: true, artwork: artworkArray });
    } else {
      res.json({ success: true, artwork: [] });
    }
  } catch (error) {
    console.error("Error getting artwork:", error);
    res.status(500).json({ message: "Error getting artwork: " + error.message });
  }
});

module.exports = router;
