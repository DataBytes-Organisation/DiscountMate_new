const express = require("express");

const alertSegmentController = require("../controllers/alertSegment.controller");
const verifyToken = require("../middleware/auth.middleware");

const router = express.Router();

// CS-13-T3: User-specific alert segments require authentication.
router.get(
    "/",
    verifyToken,
    alertSegmentController.getAlertSegments
);

router.patch(
    "/:categoryKey",
    verifyToken,
    alertSegmentController.updateAlertSegment
);

module.exports = router;
