const mongoose = require("mongoose");

module.exports = mongoose.model("TeamMember", new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: String,
  skills: [String],
  bio: String,
  avatar: String,
  socialLinks: {
    instagram: String,
    linkedin: String,
    portfolio: String
  },
  isActive: { type: Boolean, default: true },
  joinedAt: { type: Date, default: Date.now }
}));
