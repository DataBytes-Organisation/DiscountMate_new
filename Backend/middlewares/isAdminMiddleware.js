// isAdminMiddleware.js
const isAdmin = (req, res, next) => {
  if (req.user && req.user.admin) {
    next();
  } else {
    res.status(403).json({ message: "Access denied, admin only" });
  }
};

module.exports = isAdmin;
