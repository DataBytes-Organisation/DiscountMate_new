const express = require("express");
const router = express.Router();
const commentController = require("../controllers/commentController");
const authMiddleware = require("../middlewares/authMiddleware");
const commentAuthorizeMiddleware = require("../middlewares/commentAuthorizeMiddleware");
const {
  addCommentValidationRules,
  updateCommentValidationRules,
  validate,
} = require("../middlewares/commentValidationRules");

// Add a comment to a specific post
router.post(
  "/post/:postId/comment",
  authMiddleware,
  addCommentValidationRules,
  validate,
  commentController.addComment
);

// Get all comments for a specific post
router.get(
  "/post/:postId/comments",
  authMiddleware,
  commentController.getCommentsByPost
);

// Get a single comment by its ID
router.get(
  "/comment/:commentId",
  authMiddleware,
  commentController.getCommentById
);

// Update a comment by its ID
router.put(
  "/comment/:commentId",
  authMiddleware,
  commentAuthorizeMiddleware,
  updateCommentValidationRules,
  validate,
  commentController.editComment
);

// Delete a comment by its ID
router.delete(
  "/comment/:commentId",
  authMiddleware,
  commentAuthorizeMiddleware,
  commentController.deleteComment
);

// Like a comment
router.put(
  "/comment/:commentId/like",
  authMiddleware,
  commentController.likeComment
);

// Unlike a comment
router.put(
  "/comment/:commentId/unlike",
  authMiddleware,
  commentController.unlikeComment
);

// Dislike a comment
router.put(
  "/comment/:commentId/dislike",
  authMiddleware,
  commentController.dislikeComment
);

// Undislike a comment
router.put(
  "/comment/:commentId/undislike",
  authMiddleware,
  commentController.undislikeComment
);

module.exports = router;
