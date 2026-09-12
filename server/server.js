require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const Admin = require("./models/Admin");
const { streamMediaFile, findMediaFile } = require("./utils/mediaStreamer");

const app = express();

// 1. Gzip/Deflate compression for all responses (HTML, CSS, JS, JSON)
app.use(compression());

// 2. Security headers (allowing Cloudinary, CDN, and local media)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "blob:", "res.cloudinary.com", "images.unsplash.com", "cdnjs.cloudflare.com"],
      "media-src": ["'self'", "data:", "blob:", "res.cloudinary.com"],
      "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdnjs.cloudflare.com"],
      "style-src": ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
      "font-src": ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com"]
    },
  },
}));

// 3. CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || [
    "https://dsa-lksa.vercel.app",
    "https://dsa-media-crew.vercel.app", 
    "https://dsa-media-crew-git-main.vercel.app",
    "https://dsa-media-api.onrender.com",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:5000",
    "http://127.0.0.1:5000"
  ],
  credentials: true
}));

app.use(express.json());

// Resolved directory paths
const clientPath = path.resolve(__dirname, "../client");
const adminPath = path.resolve(__dirname, "../admin");
const uploadsDir = path.resolve(__dirname, "uploads");
const videosDir = path.resolve(__dirname, "videos");
const clientVideosDir = path.resolve(clientPath, "videos");
const clientMediaDir = path.resolve(clientPath, "media");
const clientImgDir = path.resolve(clientPath, "img");

console.log("Client path:", clientPath, "exists:", fs.existsSync(clientPath));
console.log("Admin path:", adminPath, "exists:", fs.existsSync(adminPath));
console.log("Uploads path:", uploadsDir, "exists:", fs.existsSync(uploadsDir));

// Helper to serve HTML with UTF-8 and no-cache
function serveHTML(filePath) {
  return (req, res) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.error("Error reading file:", filePath, err.message);
        return res.status(500).send("Error loading page");
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      res.send(data);
    });
  };
}

// ============================================
// HTML ROUTING
// ============================================
app.get("/", serveHTML(path.join(clientPath, "index.html")));
app.get("/home", serveHTML(path.join(clientPath, "home.html")));
app.get("/gallery", serveHTML(path.join(clientPath, "gallery.html")));
app.get("/team", serveHTML(path.join(clientPath, "team.html")));
app.get("/portfolio", serveHTML(path.join(clientPath, "portfolio.html")));
app.get(["/videos", "/videography-aftermovies", "/videography-aftermovies.html"], serveHTML(path.join(clientPath, "videography-aftermovies.html")));
app.get(["/designs", "/editing-designs", "/editing-designs.html"], serveHTML(path.join(clientPath, "editing-designs.html")));
app.get(["/meraki26", "/meraki26.html"], serveHTML(path.join(clientPath, "meraki26.html")));

// Admin Routes
app.get(["/admin", "/admin/dashboard", "/admin/dashboard.html", "/admin/portal", "/admin/portal.html"], serveHTML(path.join(adminPath, "portal.html")));
app.get(["/admin/login", "/admin/login.html"], serveHTML(path.join(adminPath, "login.html")));
app.get(["/upload", "/admin/upload", "/admin/professional-admin.html"], serveHTML(path.join(adminPath, "professional-admin.html")));
app.get(["/admin/artwork-upload", "/admin/artwork-upload.html"], serveHTML(path.join(adminPath, "artwork-upload.html")));
app.get(["/admin/team-portal", "/admin/team-portal.html", "/admin/team"], serveHTML(path.join(adminPath, "team-portal.html")));

// ============================================
// HIGH-PERFORMANCE STREAMING & MEDIA HANDLING
// ============================================

const searchMediaDirs = [
  uploadsDir,
  path.join(uploadsDir, "photography"),
  path.join(uploadsDir, "team"),
  path.join(uploadsDir, "gallery"),
  clientMediaDir,
  clientImgDir,
  videosDir,
  clientVideosDir
];

// High-speed /media/:filename endpoint with Range request support
app.get(["/media/:filename", "/server/uploads/:filename"], (req, res) => {
  const filename = req.params.filename;
  const filePath = findMediaFile(filename, searchMediaDirs);

  if (filePath) {
    return streamMediaFile(filePath, req, res);
  }

  // Not found
  res.status(404).json({ error: "Media file not found", filename });
});

// High-speed /videos/:filename endpoint with Range request support
app.get(["/videos/:filename", "/client/videos/:filename"], (req, res) => {
  const filename = req.params.filename;
  const filePath = findMediaFile(filename, [videosDir, clientVideosDir, uploadsDir]);

  if (filePath) {
    return streamMediaFile(filePath, req, res);
  }

  res.status(404).json({ error: "Video file not found", filename });
});

// High-performance static serving with aggressive browser caching
app.use(express.static(clientPath, {
  maxAge: '7d',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else if (/\.(jpg|jpeg|png|gif|webp|svg|ico|mp4|webm|woff2|woff|ttf|css|js)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Static directories
app.use("/server/uploads", express.static(uploadsDir));
app.use("/uploads", express.static(uploadsDir));
app.use("/media", express.static(uploadsDir));
app.use("/media", express.static(clientMediaDir));
app.use("/videos", express.static(videosDir));
app.use("/videos", express.static(clientVideosDir));
app.use("/server/data", express.static(path.resolve(__dirname, "data")));
app.use("/admin", express.static(adminPath, { maxAge: '1d' }));

// ============================================
// API ROUTES
// ============================================
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/photos", require("./routes/photoRoutes"));
app.use("/api/upload", require("./routes/simpleUpload"));
app.use("/api/events", require("./routes/eventRoutes"));
app.use("/api/local", require("./routes/localRoutes"));
app.use("/api/team", require("./routes/teamRoutes"));
app.use("/api/contact", require("./routes/contactRoutes"));
app.use("/api/reviews", require("./routes/reviewRoutes"));
app.use("/api", require("./routes/artworkRoutes"));

// Health check route
app.get("/api/health", (req, res) => {
  const isMongoConnected = mongoose.connection.readyState === 1;
  res.json({
    status: "Healthy",
    database: isMongoConnected ? "MongoDB Connected" : "Local JSON / Resilient Mode",
    connection_state: mongoose.connection.readyState,
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date()
  });
});

// 404 Handler for API routes
app.use("/api", (req, res, next) => {
  const AppError = require("./utils/appError");
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Catch-all route for other requests (404)
app.use((req, res) => {
  res.status(404).sendFile("404.html", { root: clientPath });
});

// Global Error Handler
const globalErrorHandler = require("./middleware/errorMiddleware");
app.use(globalErrorHandler);

// Create default admin account
const createDefaultAdmin = async () => {
  try {
    const existingAdmin = await Admin.findOne({ email: "admin@dsa.com" });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const admin = new Admin({
        email: "admin@dsa.com",
        password: hashedPassword
      });
      await admin.save();
      console.log("Default admin account created!");
    }
  } catch (err) {
    console.error("Error creating default admin:", err.message);
  }
};

// Resilient MongoDB connection
if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  })
  .then(async () => {
    console.log("MongoDB Connected successfully");
    await createDefaultAdmin();
  })
  .catch(err => {
    console.log("MongoDB Connection Notice (running in local/offline mode):", err.message);
  });
}

// Keep process active in headless environments
process.stdin.resume();

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () =>
  console.log("DSA Media Crew Server running on port " + PORT)
);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Server shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Server shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;
