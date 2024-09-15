// authorizeMiddleware.js
const authorize = (req, res, next) => {
  const { userId } = req.params;

  if (req.user && req.user.userId === userId) {
    next(); // User is authorized to access/modify their own data
  } else {
    res.status(403).json({ message: "Access denied, not your resource" });
  }
};

module.exports = authorize;
