const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const { cloudinary } = require('../config/cloudinary');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const uploadsDir = path.resolve(__dirname, '../uploads');
const thumbsDir = path.join(uploadsDir, 'thumbs');

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const VIDEO_EXTS = ['.mp4', '.mov', '.webm'];

const isCloudinaryConfigured = () => Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

const formatSize = (bytes) => (bytes / (1024 * 1024)).toFixed(1) + ' MB';

/**
 * Read dimensions of an image and write a 600px webp thumbnail next to the uploads.
 */
async function processImage(filePath, baseName) {
  const meta = await sharp(filePath).metadata();
  // EXIF orientation 5-8 means the stored pixels are rotated 90°
  const rotated = meta.orientation && meta.orientation >= 5;
  const width = rotated ? meta.height : meta.width;
  const height = rotated ? meta.width : meta.height;

  fs.mkdirSync(thumbsDir, { recursive: true });
  const thumbName = `${baseName}-thumb.webp`;
  await sharp(filePath)
    .rotate()
    .resize({ width: 600, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(path.join(thumbsDir, thumbName));

  return { width, height, thumbPath: path.join(thumbsDir, thumbName), thumbName };
}

function probeVideo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const stream = (data.streams || []).find(s => s.codec_type === 'video') || {};
      const rotation = Math.abs(parseInt(stream.tags?.rotate || stream.side_data_list?.[0]?.rotation || 0, 10));
      const swap = rotation === 90 || rotation === 270;
      resolve({
        durationSec: data.format?.duration ? parseFloat(data.format.duration) : null,
        width: swap ? stream.height : stream.width,
        height: swap ? stream.width : stream.height
      });
    });
  });
}

function extractPoster(filePath, atSec, posterName) {
  fs.mkdirSync(thumbsDir, { recursive: true });
  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .on('end', () => resolve(path.join(thumbsDir, posterName)))
      .on('error', reject)
      .screenshots({
        timestamps: [atSec],
        filename: posterName,
        folder: thumbsDir,
        size: '960x?'
      });
  });
}

/**
 * Read metadata, build a thumbnail (image) or poster frame (video).
 * Never throws for metadata problems: a file we can't probe is still stored.
 */
async function analyseFile(file) {
  const ext = path.extname(file.filename).toLowerCase();
  const baseName = path.basename(file.filename, ext);
  const isVideo = VIDEO_EXTS.includes(ext);
  const result = { isVideo, width: null, height: null, durationSec: null, thumbPath: null };

  try {
    if (isVideo) {
      const meta = await probeVideo(file.path);
      Object.assign(result, meta);
      const at = meta.durationSec ? Math.min(1, meta.durationSec / 2) : 0;
      result.thumbPath = await extractPoster(file.path, at, `${baseName}-poster.jpg`);
    } else {
      const meta = await processImage(file.path, baseName);
      result.width = meta.width;
      result.height = meta.height;
      result.thumbPath = meta.thumbPath;
    }
  } catch (err) {
    console.warn(`Media analysis notice for ${file.originalname}:`, err.message);
  }
  return result;
}

function uploadLarge(filePath, options) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_large(filePath, options, (err, res) => (err ? reject(err) : resolve(res)));
  });
}

/**
 * Store an uploaded file (Cloudinary when configured, local disk otherwise)
 * and return the fields to save on MediaAsset.
 */
async function storeUpload(file, { category }) {
  const analysis = await analyseFile(file);
  const { isVideo } = analysis;

  const record = {
    type: isVideo ? 'video' : 'image',
    width: analysis.width || null,
    height: analysis.height || null,
    durationSec: analysis.durationSec || null,
    res: analysis.width && analysis.height ? `${analysis.width} x ${analysis.height}` : null,
    size: formatSize(file.size),
    sizeBytes: file.size
  };

  let cloudRes = null;
  if (isCloudinaryConfigured()) {
    try {
      cloudRes = isVideo
        ? await uploadLarge(file.path, { resource_type: 'video', folder: `dsa_media/${category}` })
        : await cloudinary.uploader.upload(file.path, { resource_type: 'image', folder: `dsa_media/${category}` });
    } catch (err) {
      const reason = err.http_code ? `Cloudinary ${err.http_code}: ${err.message}` : (err.message || String(err));
      if (process.env.NODE_ENV === 'production') {
        for (const p of [file.path, analysis.thumbPath]) {
          if (p) fs.promises.unlink(p).catch(() => {});
        }
        throw new Error(`Cloud storage upload failed (${reason})`);
      }
      // Development: keep working with local files
      console.warn(`Cloudinary upload failed, storing locally instead (${reason})`);
    }
  }

  if (cloudRes) {
    const resourceType = isVideo ? 'video' : 'image';
    const thumb = isVideo
      ? cloudinary.url(cloudRes.public_id, { resource_type: 'video', format: 'jpg', secure: true, transformation: [{ start_offset: 1, width: 960, crop: 'limit' }] })
      : cloudinary.url(cloudRes.public_id, { secure: true, transformation: [{ width: 600, crop: 'limit', fetch_format: 'auto', quality: 'auto' }] });

    // Cloudinary holds the originals now; drop local copies
    for (const p of [file.path, analysis.thumbPath]) {
      if (p) fs.promises.unlink(p).catch(() => {});
    }

    return {
      ...record,
      fileUrl: cloudRes.secure_url,
      thumbnailUrl: thumb,
      posterUrl: isVideo ? thumb : null,
      storage: 'cloudinary',
      cloudPublicId: `${resourceType}:${cloudRes.public_id}`
    };
  }

  // Render's disk is wiped on every deploy, so local storage is dev-only
  if (process.env.NODE_ENV === 'production') {
    for (const p of [file.path, analysis.thumbPath]) {
      if (p) fs.promises.unlink(p).catch(() => {});
    }
    throw new Error('Cloudinary is not configured. Set CLOUDINARY_* environment variables to upload in production.');
  }

  const thumbUrl = analysis.thumbPath ? `/media/thumbs/${path.basename(analysis.thumbPath)}` : null;
  return {
    ...record,
    fileUrl: `/media/${file.filename}`,
    thumbnailUrl: thumbUrl || `/media/${file.filename}`,
    posterUrl: isVideo ? thumbUrl : null,
    storage: 'local',
    cloudPublicId: null
  };
}

/**
 * Remove the stored file(s) for a MediaAsset. Failures are logged, not thrown,
 * so a missing file never blocks deleting the database row.
 */
async function deleteStoredFile(asset) {
  try {
    if (asset.storage === 'cloudinary' && asset.cloudPublicId) {
      const [resourceType, publicId] = asset.cloudPublicId.split(/:(.*)/s);
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
      return;
    }

    for (const url of [asset.fileUrl, asset.thumbnailUrl, asset.posterUrl]) {
      if (!url || !url.startsWith('/media/')) continue;
      const rel = url.replace(/^\/media\//, '');
      const target = path.resolve(uploadsDir, rel);
      // Only delete inside server/uploads (seeded assets point at client/media)
      if (!target.startsWith(uploadsDir + path.sep)) continue;
      await fs.promises.unlink(target).catch(() => {});
    }
  } catch (err) {
    console.warn(`Could not delete stored file for ${asset.id}:`, err.message);
  }
}

module.exports = {
  IMAGE_EXTS,
  VIDEO_EXTS,
  uploadsDir,
  storeUpload,
  deleteStoredFile,
  isCloudinaryConfigured
};
