const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");
const isAdminMiddleware = require("../middleware/isAdminMiddleware");
const authorizeMiddleware = require("../middleware/authorizeMiddleware");
const {
  userValidationRules,
  validate,
} = require("../middleware/userValidationRules");

// User Routes
router.post("/signup", userValidationRules, validate, userController.signup); // Validate user on signup
router.post("/signin", userController.signin); // Login route (no validation middleware needed here)

// Routes that require authentication
router.get("/profile", authMiddleware, userController.getProfile); // Requires user to be logged in

// Update user details, only the user themselves can update their profile
router.put(
  "/:userId",
  authMiddleware,
  authorizeMiddleware,
  userValidationRules,
  validate,
  userController.updateUser
);

// Delete a user, only admins can delete users
router.delete(
  "/:userId",
  authMiddleware,
  isAdminMiddleware,
  userController.deleteUser
);

// Get all users, only admins can access this
router.get("/", authMiddleware, isAdminMiddleware, userController.getAllUsers);

module.exports = router;
