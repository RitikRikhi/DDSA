const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  let token = req.header("Authorization");
  if (!token) return res.status(401).json({ msg: "Access Denied" });

  if (token.startsWith("Bearer ")) {
    token = token.slice(7).trim();
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = verified;
    next();
  } catch {
    res.status(400).json({ msg: "Invalid Token" });
  }
};