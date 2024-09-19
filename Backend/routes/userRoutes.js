const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middlewares/authMiddleware");
const isAdminMiddleware = require("../middlewares/isAdminMiddleware");
const userAuthorizeMiddleware = require("../middlewares/userAuthorizeMiddleware");
const {
  userValidationRules,
  userUpdateValidationRules,
  validate,
} = require("../middlewares/userValidationRules");

router.post("/signup", userValidationRules, validate, userController.signup);

router.post("/signin", userController.signin);

router.get("/profile", authMiddleware, userController.getProfile);

router.put(
  "/:userId",
  authMiddleware,
  userAuthorizeMiddleware,
  userUpdateValidationRules,
  validate,
  userController.updateUser
);

router.delete(
  "/:userId",
  authMiddleware,
  (req, res, next) => {
    if (req.user.userId === req.params.userId || req.user.isAdmin) {
      next();
    } else {
      res.status(403).json({ message: "Access denied, admin only" });
    }
  },
  userController.deleteUser
);

router.get("/", authMiddleware, isAdminMiddleware, userController.getAllUsers);

module.exports = router;
