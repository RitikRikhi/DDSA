const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith('video/');
    return {
      folder: 'dsa_media',
      resource_type: isVideo ? 'video' : 'image',
      allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'mp4', 'mov', 'webm'],
      transformation: isVideo ? [] : [
        { width: 1200, height: 800, crop: 'limit', quality: 'auto:good', fetch_format: 'auto' }
      ],
      eager: isVideo ? [] : [
        { width: 600, height: 400, crop: 'fill', quality: 'auto:good', fetch_format: 'auto' }
      ]
    };
  },
});

module.exports = { cloudinary, storage };
