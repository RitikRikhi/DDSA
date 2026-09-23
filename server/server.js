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
const prisma = require("./config/prisma");

const app = express();

// 1. Gzip/Deflate compression for all responses (HTML, CSS, JS, JSON)
app.use(compression());

// 2. Security headers (allowing Cloudinary, CDN, fonts, and local media)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "blob:", "res.cloudinary.com", "images.unsplash.com", "cdnjs.cloudflare.com", "via.placeholder.com"],
      "media-src": ["'self'", "data:", "blob:", "res.cloudinary.com"],
      "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdnjs.cloudflare.com", "cdn.jsdelivr.net"],
      "style-src": ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com", "cdn.jsdelivr.net"],
      "font-src": ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com", "data:"],
      "connect-src": ["'self'", "https://api.cloudinary.com", "https://res.cloudinary.com", "*"]
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
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
app.use(express.urlencoded({ extended: true }));

// Resolved directory paths
const clientPath = path.resolve(__dirname, "../client");
const adminPath = path.resolve(__dirname, "../admin");
const uploadsDir = path.resolve(__dirname, "uploads");
const videosDir = path.resolve(__dirname, "videos");
const clientVideosDir = path.resolve(clientPath, "videos");
const clientMediaDir = path.resolve(clientPath, "media");
const clientImgDir = path.resolve(clientPath, "img");

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
// HTML ROUTING (Preserving all existing routes)
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

// Static directories
app.use("/server/uploads", express.static(uploadsDir));
app.use("/uploads", express.static(uploadsDir));
app.use("/media", express.static(uploadsDir));
app.use("/media", express.static(clientMediaDir));
app.use("/videos", express.static(videosDir));
app.use("/videos", express.static(clientVideosDir));
app.use("/server/data", express.static(path.resolve(__dirname, "data")));
app.use("/admin", express.static(adminPath, { maxAge: '1d' }));

// Static client assets with aggressive caching for media
app.use(express.static(clientPath, {
  maxAge: '7d',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (/\.(html|js|css|json)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (/\.(jpg|jpeg|png|gif|webp|svg|ico|mp4|webm|woff2|woff|ttf)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// ============================================
// PRODUCTION REST API ROUTES
// ============================================
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/events", require("./routes/eventRoutes"));
app.use("/api/attendance", require("./routes/attendanceRoutes"));
app.use("/api/equipment", require("./routes/equipmentRoutes"));
app.use("/api/media", require("./routes/mediaRoutes"));
app.use("/api/photos", require("./routes/mediaRoutes")); // unified media & photos
app.use("/api/upload", require("./routes/mediaRoutes")); // unified upload pipeline
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/activity-logs", require("./routes/activityLogRoutes"));
app.use("/api/team", require("./routes/teamRoutes"));
app.use("/api", require("./routes/departmentRoutes"));
app.use("/api/contact", require("./routes/contactRoutes"));
app.use("/api/reviews", require("./routes/reviewRoutes"));
app.use("/api", require("./routes/artworkRoutes"));

// Health check route
app.get("/api/health", async (req, res) => {
  let isPrismaHealthy = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    isPrismaHealthy = true;
  } catch (e) {}

  res.json({
    status: "Healthy",
    database: isPrismaHealthy ? "Prisma SQLite Connected" : "Local Resilient Mode",
    prisma: isPrismaHealthy ? "Connected" : "Disconnected",
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
    // Non-fatal if Mongo not used
  }
};

// Resilient MongoDB connection (if configured and not in test mode)
if (process.env.MONGO_URI && process.env.NODE_ENV !== 'test') {
  mongoose.connection.on('error', err => {
    // Silence/log background reconnection failures
  });

  mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 3000,
  })
  .then(async () => {
    console.log("MongoDB Connected successfully");
    await createDefaultAdmin();
  })
  .catch(err => {
    console.log("MongoDB Connection Notice (running with Prisma SQLite engine):", err.message);
  });
}

// Prevent process exit on unhandled background rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('exit', (code) => {
  console.log(`Process exiting with code: ${code}`);
});

process.on('beforeExit', (code) => {
  console.log(`Process beforeExit with code: ${code}`);
});

// Start server if not running in test mode
let server;
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5000;
  server = app.listen(PORT, () =>
    console.log("🚀 DSA Media Crew Production Server running on port " + PORT)
  );

  server.on('error', (err) => {
    console.error('Server encountered an error:', err);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('Server shutting down...');
    server.close(async () => {
      await prisma.$disconnect();
      console.log('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = app;
