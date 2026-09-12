const mongoose = require("mongoose");

module.exports = mongoose.model("Photo", new mongoose.Schema({
  title: String,
  imageUrl: String,
  publicId: String, // Added for Cloudinary deletion
  type: { type: String, default: 'image' },
  category: String,
  eventName: String, // Specific event name (e.g., "Annual Fest 2026", "Sports Day")
  eventDate: Date, // Date of the event
  description: String, // Description of the media
  rotation: { type: Number, default: 0 },
  uploadedAt: { type: Date, default: Date.now }
}));