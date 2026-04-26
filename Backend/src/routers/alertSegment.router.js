const express = require("express");
const alertSegmentController = require("../controllers/alertSegment.controller");

const router = express.Router();

router.get("/", alertSegmentController.getAlertSegments);
router.patch("/:categoryKey", alertSegmentController.updateAlertSegment);

module.exports = router;
