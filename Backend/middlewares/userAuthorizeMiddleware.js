// authorizeMiddleware.js
const userAuthorizeMiddleware = (req, res, next) => {
  const userId = req.params.userId; // Get userId from the URL parameters
  const loggedInUserId = req.user.userId; // Get logged-in userId from JWT payload

  // Allow if the user is updating their own profile or if they are an admin
  if (loggedInUserId === userId || req.user.isAdmin) {
    next();
  } else {
    return res.status(403).json({
      message: "Access denied: Not authorized to perform this action.",
    });
  }
};

module.exports = userAuthorizeMiddleware;
