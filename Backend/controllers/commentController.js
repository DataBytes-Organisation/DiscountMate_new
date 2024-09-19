const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Reply = require("../models/Reply");

// Create a new comment for a post
// Create a new comment for a post
exports.addComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (!req.body.comment) {
      return res.status(400).json({ message: "Comment is required" });
    }

    const newComment = new Comment({
      user: req.user.userId, // Store user ID
      comment: req.body.comment,
    });

    const savedComment = await newComment.save();
    await savedComment.populate("user", "user_fname user_lname"); // Populate user details
    post.comments.push(savedComment._id);
    await post.save();

    res.status(201).json(savedComment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all comments for a specific post
exports.getCommentsByPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId).populate({
      path: "comments",
      select: "user comment likes dislikes createdAt replies",
      populate: [
        {
          path: "user",
          select: "user_fname user_lname", // Populate the user details of the comment
        },
        {
          path: "replies",
          populate: {
            path: "user",
            select: "user_fname user_lname", // Populate the user details of the reply
          },
          select: "user replyText likes dislikes createdAt",
        },
      ],
    });

    if (!post) {
      console.error("Post not found");
      return res.status(404).json({ message: "Post not found" });
    }

    // Remove redundant population calls
    res.status(200).json(post.comments);
  } catch (err) {
    console.error("Error in getCommentsByPost:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getCommentById = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId)
      .populate({
        path: "user",
        select: "user_fname user_lname",
      }) // Populate the user details of the comment
      .populate({
        path: "replies",
        populate: {
          path: "user",
          select: "user_fname user_lname", // Populate the user details of the reply
        },
        select: "user replyText likes dislikes createdAt",
      });

    if (!comment) return res.status(404).json({ message: "Comment not found" });

    // No need to convert to object explicitly
    res.status(200).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update a comment (edit)
exports.editComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    // Only allow the comment owner or admin to edit
    if (comment.user.toString() !== req.user.userId && !req.user.isAdmin) {
      return res.status(403).json({ message: "Unauthorized action" });
    }

    comment.comment = req.body.comment;
    await comment.save();
    res.status(200).json({
      message: "Comment updated successfully",
      updatedComment: comment,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete a comment
exports.deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    // Only allow the comment owner or admin to delete
    if (comment.user.toString() !== req.user.userId && !req.user.isAdmin) {
      return res.status(403).json({ message: "Unauthorized action" });
    }

    await Comment.findByIdAndDelete(req.params.commentId);
    res.status(200).json({ message: "Comment deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Like a comment
exports.likeComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    // Check if user already liked the comment
    if (comment.likedBy.includes(req.user.userId)) {
      return res
        .status(400)
        .json({ message: "You have already liked this comment" });
    }

    // If the user previously disliked the comment, remove dislike
    if (comment.dislikedBy.includes(req.user.userId)) {
      comment.dislikes -= 1;
      comment.dislikedBy.pull(req.user.userId);
    }

    // Add the user to the likedBy array and increment likes
    comment.likes += 1;
    comment.likedBy.push(req.user.userId);

    await comment.save();
    res.status(200).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Unlike a comment
exports.unlikeComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    // Check if the user hasn't liked the comment yet
    if (!comment.likedBy.includes(req.user.userId)) {
      return res
        .status(400)
        .json({ message: "You haven't liked this comment" });
    }

    // Remove like
    comment.likes -= 1;
    comment.likedBy.pull(req.user.userId);

    await comment.save();
    res.status(200).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Dislike a comment
exports.dislikeComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    // Check if user already disliked the comment
    if (comment.dislikedBy.includes(req.user.userId)) {
      return res
        .status(400)
        .json({ message: "You have already disliked this comment" });
    }

    // If the user previously liked the comment, remove like
    if (comment.likedBy.includes(req.user.userId)) {
      comment.likes -= 1;
      comment.likedBy.pull(req.user.userId);
    }

    // Add the user to the dislikedBy array and increment dislikes
    comment.dislikes += 1;
    comment.dislikedBy.push(req.user.userId);

    await comment.save();
    res.status(200).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Undislike a comment
exports.undislikeComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    // Check if the user hasn't disliked the comment yet
    if (!comment.dislikedBy.includes(req.user.userId)) {
      return res
        .status(400)
        .json({ message: "You haven't disliked this comment" });
    }

    // Remove dislike
    comment.dislikes -= 1;
    comment.dislikedBy.pull(req.user.userId);

    await comment.save();
    res.status(200).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
