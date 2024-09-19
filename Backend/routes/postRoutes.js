const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const authMiddleware = require("../middlewares/authMiddleware");
const postAuthorizeMiddleware = require("../middlewares/postAuthorizeMiddleware");
const {
  postValidationRules,
  updatePostValidationRules,
  commentValidationRules,
  validatePostId,
  validate,
} = require("../middlewares/postValidationRules");

router.post(
  "/",
  authMiddleware,
  postValidationRules,
  validate,
  postController.createPost
);

router.get("/", authMiddleware, postController.getPosts);

router.post(
  "/:postId/like",
  authMiddleware,
  validatePostId,
  validate,
  postController.likePost
);

router.post(
  "/:postId/unlike",
  authMiddleware,
  validatePostId,
  validate,
  postController.unlikePost
);

router.post(
  "/:postId/dislike",
  authMiddleware,
  validatePostId,
  validate,
  postController.dislikePost
);

router.post(
  "/:postId/undislike",
  authMiddleware,
  validatePostId,
  validate,
  postController.undislikePost
);

router.put(
  "/:postId",
  authMiddleware,
  validatePostId,
  validate,
  postAuthorizeMiddleware,
  updatePostValidationRules,
  validate,
  postController.editPost
);

router.delete(
  "/:postId",
  authMiddleware,
  validatePostId,
  validate,
  postAuthorizeMiddleware,
  postController.deletePost
);

module.exports = router;
