const fs = require("fs");
const path = require("path");

const MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".ogg": "video/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

/**
 * Stream a media file with HTTP Range (206 Partial Content) & high-speed caching support.
 */
function streamMediaFile(filePath, req, res) {
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Media file not found" });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const isVideo = ext === ".mp4" || ext === ".webm" || ext === ".mov" || ext === ".ogg";

  // HTTP ETag for caching
  const etag = `"${stat.size}-${stat.mtime.getTime()}"`;
  if (req.headers["if-none-match"] === etag) {
    return res.status(304).end();
  }

  // Cache Control: Long cache for production speed
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("ETag", etag);
  res.setHeader("Last-Modified", stat.mtime.toUTCString());
  res.setHeader("Accept-Ranges", "bytes");

  // Handle Range Requests for instant video seeking and buffer playback
  const range = req.headers.range;
  if (isVideo && range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + (1024 * 1024 * 2) - 1, fileSize - 1); // 2MB chunk

    if (start >= fileSize) {
      res.setHeader("Content-Range", `bytes */${fileSize}`);
      return res.status(416).send("Requested range not satisfiable");
    }

    const chunksize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": contentType,
    });

    fileStream.pipe(res);
  } else {
    // Normal streaming for images / non-range requests
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": contentType,
    });
    fs.createReadStream(filePath).pipe(res);
  }
}

/**
 * Resolve a filename across common upload and asset folders
 */
function findMediaFile(filename, searchDirs) {
  for (const dir of searchDirs) {
    const potentialPath = path.join(dir, filename);
    if (fs.existsSync(potentialPath)) {
      return potentialPath;
    }
  }
  return null;
}

module.exports = {
  streamMediaFile,
  findMediaFile,
  MIME_TYPES
};
