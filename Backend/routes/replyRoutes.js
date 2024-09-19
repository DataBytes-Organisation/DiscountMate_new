const express = require("express");
const router = express.Router();
const replyController = require("../controllers/replyController");
const authMiddleware = require("../middlewares/authMiddleware");
const replyAuthorizeMiddleware = require("../middlewares/replyAuthorizeMiddleware");
const {
  addReplyValidationRules,
  updateReplyValidationRules,
  validate,
} = require("../middlewares/replyValidationRules");

// Add a reply to a comment
router.post(
  "/comment/:commentId/reply",
  authMiddleware,
  addReplyValidationRules,
  validate,
  replyController.addReply
);

// Get all replies for a comment
router.get(
  "/comment/:commentId/replies",
  authMiddleware,
  replyController.getRepliesByComment
);

// Update a reply
router.put(
  "/reply/:replyId",
  authMiddleware,
  replyAuthorizeMiddleware,
  updateReplyValidationRules,
  validate,
  replyController.editReply
);

// Delete a reply
router.delete(
  "/reply/:replyId",
  authMiddleware,
  replyAuthorizeMiddleware,
  replyController.deleteReply
);

// Like a reply
router.put("/reply/:replyId/like", authMiddleware, replyController.likeReply);

// Unlike a reply
router.put(
  "/reply/:replyId/unlike",
  authMiddleware,
  replyController.unlikeReply
);

// Dislike a reply
router.put(
  "/reply/:replyId/dislike",
  authMiddleware,
  replyController.dislikeReply
);

// Undislike a reply
router.put(
  "/reply/:replyId/undislike",
  authMiddleware,
  replyController.undislikeReply
);

module.exports = router;
