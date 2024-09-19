const Post = require("../models/Post");

const postAuthorizeMiddleware = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if the logged-in user is the post owner or an admin
    if (post.user.toString() !== req.user.userId && !req.user.isAdmin) {
      return res.status(403).json({ message: "Unauthorized action" });
    }

    // Attach the post to the request object for further use
    req.post = post;
    next();
  } catch (err) {
    console.error("Error authorizing post action:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = postAuthorizeMiddleware;
