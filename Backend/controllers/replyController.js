const Comment = require("../models/Comment");
const Reply = require("../models/Reply");

// Add a reply to a comment
exports.addReply = async (req, res) => {
  try {
    // Fetch the comment to ensure it exists
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Check for missing reply text
    if (!req.body.replyText) {
      return res.status(400).json({ message: "Reply content is required" });
    }

    // Create a new reply object
    const newReply = new Reply({
      user: req.user.userId, // Ensure req.user is set correctly
      comment: comment._id,
      replyText: req.body.replyText,
    });

    // Save the new reply to the database
    const savedReply = await newReply.save();

    // Ensure the replies array exists and add the new reply's ID
    comment.replies = comment.replies || [];
    comment.replies.push(savedReply._id);

    // Save the updated comment
    await comment.save();

    // Populate the user details of the saved reply
    await savedReply.populate("user", "user_fname user_lname");

    // Respond with the saved reply details
    res.status(201).json({
      message: "Reply added successfully",
      reply: savedReply,
    });
  } catch (err) {
    console.error("Error adding reply:", err); // Log the error to help debug
    res.status(500).json({ error: err.message });
  }
};
// Get all replies for a specific comment
exports.getRepliesByComment = async (req, res) => {
  try {
    const replies = await Reply.find({ comment: req.params.commentId })
      .populate("user", "user_fname user_lname") // Populate user details
      .select("user replyText likes dislikes createdAt");

    res.status(200).json(replies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update a reply
exports.editReply = async (req, res) => {
  try {
    const reply = await Reply.findById(req.params.replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    // Only allow the reply owner or admin to edit
    if (reply.user.toString() !== req.user.userId && !req.user.isAdmin) {
      return res.status(403).json({ message: "Unauthorized action" });
    }

    reply.replyText = req.body.replyText;
    await reply.save();
    res.status(200).json({ message: "Reply updated successfully", reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete a reply
exports.deleteReply = async (req, res) => {
  try {
    const reply = await Reply.findById(req.params.replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    // Only allow the reply owner or admin to delete
    if (reply.user.toString() !== req.user.userId && !req.user.isAdmin) {
      return res.status(403).json({ message: "Unauthorized action" });
    }

    // Find the comment associated with the reply
    const comment = await Comment.findById(reply.comment);
    if (comment) {
      // Remove the reply ID from the comment's replies array
      comment.replies = comment.replies.filter(
        (replyId) => replyId.toString() !== reply._id.toString()
      );
      await comment.save();
    }

    // Delete the reply
    await Reply.findByIdAndDelete(req.params.replyId);

    res.status(200).json({ message: "Reply deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Like a reply
exports.likeReply = async (req, res) => {
  try {
    const reply = await Reply.findById(req.params.replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    if (reply.likedBy.includes(req.user.userId)) {
      return res
        .status(400)
        .json({ message: "You have already liked this reply" });
    }

    reply.likes += 1;
    reply.likedBy.push(req.user.userId);

    await reply.save();
    res.status(200).json({ message: "Reply liked", likes: reply.likes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Unlike a reply
exports.unlikeReply = async (req, res) => {
  try {
    const reply = await Reply.findById(req.params.replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    if (!reply.likedBy.includes(req.user.userId)) {
      return res.status(400).json({ message: "You haven't liked this reply" });
    }

    reply.likes -= 1;
    reply.likedBy = reply.likedBy.filter(
      (userId) => userId.toString() !== req.user.userId
    );

    await reply.save();
    res.status(200).json({ message: "Reply unliked", likes: reply.likes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Dislike a reply
exports.dislikeReply = async (req, res) => {
  try {
    const reply = await Reply.findById(req.params.replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    if (reply.dislikedBy.includes(req.user.userId)) {
      return res
        .status(400)
        .json({ message: "You have already disliked this reply" });
    }

    reply.dislikes += 1;
    reply.dislikedBy.push(req.user.userId);

    await reply.save();
    res
      .status(200)
      .json({ message: "Reply disliked", dislikes: reply.dislikes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Undislike a reply
exports.undislikeReply = async (req, res) => {
  try {
    const reply = await Reply.findById(req.params.replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    if (!reply.dislikedBy.includes(req.user.userId)) {
      return res
        .status(400)
        .json({ message: "You haven't disliked this reply" });
    }

    reply.dislikes -= 1;
    reply.dislikedBy = reply.dislikedBy.filter(
      (userId) => userId.toString() !== req.user.userId
    );

    await reply.save();
    res
      .status(200)
      .json({ message: "Reply undisliked", dislikes: reply.dislikes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
