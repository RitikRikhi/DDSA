const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const Inquiry = require("../models/inquiry");
const nodemailer = require("nodemailer");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

// Local backup storage file
const dataDir = path.resolve(__dirname, "../data");
const inquiriesFilePath = path.join(dataDir, "inquiries.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function saveLocalInquiry(inquiryData) {
  try {
    let inquiries = [];
    if (fs.existsSync(inquiriesFilePath)) {
      const fileData = fs.readFileSync(inquiriesFilePath, "utf8");
      inquiries = JSON.parse(fileData || "[]");
    }
    inquiries.push({
      ...inquiryData,
      createdAt: new Date().toISOString()
    });
    fs.writeFileSync(inquiriesFilePath, JSON.stringify(inquiries, null, 2), "utf8");
    console.log("Inquiry backed up locally to inquiries.json");
  } catch (err) {
    console.warn("Failed to backup inquiry to local JSON file:", err.message);
  }
}

// Mail transporter configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // upgrades to TLS with STARTTLS on 587
  requireTLS: true,
  family: 4, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

router.post("/", catchAsync(async (req, res, next) => {
    console.log('--- Incoming Contact Form Request ---');
    console.log('Origin:', req.headers.origin);
    console.log('Body:', req.body);
    const { name, email, purpose, message } = req.body;

    if (!name || !email || !purpose || !message) {
      return next(new AppError("All fields (name, email, purpose, message) are required", 400));
    }

    const inquiryData = {
      name: name.trim(),
      email: email.trim(),
      purpose: purpose.trim(),
      message: message.trim(),
      createdAt: new Date()
    };

    // 1. Try saving to MongoDB if connected
    let savedInquiry = inquiryData;
    try {
      if (mongoose.connection.readyState === 1) {
        const newInquiry = new Inquiry(inquiryData);
        savedInquiry = await newInquiry.save();
        console.log("Inquiry successfully saved to MongoDB database.");
      }
    } catch (dbErr) {
      console.warn("MongoDB save skipped/failed:", dbErr.message);
    }

    // 2. Always backup to local inquiries.json
    saveLocalInquiry(inquiryData);

    // 3. Send email notification via SMTP
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const mailOptions = {
        from: `"DSA Media Crew Web" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_USER,
        replyTo: email,
        subject: `New Contact Form Inquiry: ${purpose} [${name}]`,
        html: `
          <div style="font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; background-color: #0a0a0a; color: #ffffff; padding: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); padding: 30px 20px; text-align: center; border-bottom: 3px solid #c8102e;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 2px;">
                <span style="color: #c8102e;">DSA</span><span style="color: #b8a06a; margin: 0 4px;">·</span><span style="color: #ffffff;">MEDIA CREW</span>
              </h1>
              <p style="color: #b8a06a; margin: 10px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 3px; font-weight: 600;">Website Contact Inquiry</p>
            </div>
            
            <!-- Content Body -->
            <div style="padding: 40px 30px; background-color: #111111;">
              <div style="background-color: #1a1a1a; padding: 25px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #c8102e; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #333333; width: 100px;"><strong style="color: #888888; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Name:</strong></td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #333333; color: #ffffff; font-size: 16px; font-weight: 500;">${name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #333333;"><strong style="color: #888888; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Email:</strong></td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #333333;"><a href="mailto:${email}" style="color: #b8a06a; text-decoration: none; font-size: 16px; transition: color 0.3s;">${email}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0;"><strong style="color: #888888; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Purpose:</strong></td>
                    <td style="padding: 12px 0;">
                      <span style="background: rgba(200, 16, 46, 0.15); color: #c8102e; border: 1px solid rgba(200, 16, 46, 0.3); padding: 6px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; letter-spacing: 0.5px;">${purpose}</span>
                    </td>
                  </tr>
                </table>
              </div>
              
              <div style="margin-bottom: 20px;">
                <h3 style="color: #ffffff; margin-top: 0; margin-bottom: 15px; font-size: 15px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #333333; padding-bottom: 10px; display: inline-block;">Message Content</h3>
                <div style="background-color: #161616; border: 1px solid #222222; padding: 25px; border-radius: 8px; color: #dddddd; line-height: 1.8; white-space: pre-wrap; font-size: 15px; box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);">${message}</div>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #050505; text-align: center; padding: 25px; border-top: 1px solid #222222;">
              <p style="margin: 0; color: #666666; font-size: 12px; line-height: 1.6;">
                Automated notification from DSA Media Crew Official Platform.
                <br>Click reply to directly message <strong style="color: #b8a06a;">${email}</strong>.
              </p>
            </div>
          </div>
        `
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("--- SMTP DISPATCH NOTICE ---");
          console.error("Detail:", error.message);
        } else {
          console.log("--- SMTP SUCCESS ---");
          console.log("Delivered:", info.response);
        }
      });
    }

    // 4. Submit to Google Form if configured
    if (process.env.GOOGLE_FORM_URL) {
      try {
        const formData = new URLSearchParams();
        formData.append(process.env.GOOGLE_FORM_ENTRY_NAME || 'entry.1', name);
        formData.append(process.env.GOOGLE_FORM_ENTRY_EMAIL || 'entry.2', email);
        formData.append(process.env.GOOGLE_FORM_ENTRY_PURPOSE || 'entry.3', purpose);
        formData.append(process.env.GOOGLE_FORM_ENTRY_MESSAGE || 'entry.4', message);

        fetch(process.env.GOOGLE_FORM_URL, {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }).catch(gErr => console.error("Google Form submission error:", gErr.message));
      } catch (gFormError) {
        console.error("Error dispatching to Google Form:", gFormError.message);
      }
    }

    res.status(200).json({
      success: true,
      message: "Thank you! Your message has been received. The crew will get back to you shortly.",
      inquiry: savedInquiry
    });
}));

// Diagnostic endpoint for testing email configuration
router.get("/test-email", catchAsync(async (req, res) => {
  console.log("--- Manual Email Test Triggered ---");
  const testMailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject: "DSA Media Crew: Email Transporter Diagnostic",
    text: "If you receive this, your SMTP configuration is working correctly."
  };

  try {
    const info = await transporter.sendMail(testMailOptions);
    console.log("Diagnostic email sent:", info.response);
    res.json({ status: "Success", details: info.response });
  } catch (error) {
    console.error("DIAGNOSTIC NOTICE: Transporter:", error.message);
    res.status(500).json({ 
      status: "Failed", 
      message: error.message,
      code: error.code
    });
  }
}));

module.exports = router;
