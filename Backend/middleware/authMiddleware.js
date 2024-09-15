const jwt = require("jsonwebtoken");

const authenticate = (req, res, next) => {
  const token =
    req.headers.authorization && req.headers.authorization.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  // Use the JWT secret from the environment variable
  const secret = process.env.JWT_SECRET;

  jwt.verify(token, secret, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid token" });

    req.user = decoded; // Save the decoded token (user information) in the request object
    next();
  });
};

module.exports = authenticate;
