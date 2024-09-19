const Reply = require("../models/Reply");

const replyAuthorizeMiddleware = async (req, res, next) => {
  try {
    // Find the reply by its ID
    const reply = await Reply.findById(req.params.replyId);

    // Check if the reply exists
    if (!reply) {
      return res.status(404).json({ message: "Reply not found" });
    }

    // Check if the user owns the reply or is an admin
    if (reply.user.toString() !== req.user.userId && !req.user.isAdmin) {
      return res.status(403).json({ message: "Unauthorized action" });
    }

    // If authorization checks pass, proceed to the next middleware or controller
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = replyAuthorizeMiddleware;
