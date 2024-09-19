const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {
  const authorizationHeader = req.headers.authorization;
  const token = authorizationHeader && authorizationHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const secret = process.env.JWT_SECRET;

  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // Attach userId and other info from the token to req.user
    req.user = {
      userId: decoded.userId,
      useremail: decoded.useremail,
      isAdmin: decoded.admin,
    };

    next();
  });
};

module.exports = authenticate;
