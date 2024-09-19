const Comment = require("../models/Comment");

// Middleware to authorize user for comment actions (edit, delete)
const commentAuthorizeMiddleware = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Check if the logged-in user is the owner of the comment or an admin
    if (comment.user.toString() !== req.user.userId && !req.user.isAdmin) {
      return res.status(403).json({ message: "Unauthorized action" });
    }

    // Attach comment to request in case it's needed later in the request cycle
    req.comment = comment;
    next();
  } catch (err) {
    console.error("Error authorizing comment action:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = commentAuthorizeMiddleware;
