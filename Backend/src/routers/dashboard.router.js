const express = require("express");
const { getDashboardSummary } = require("../controllers/dashboard.controller");
const verifyToken = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/summary", verifyToken, getDashboardSummary);

module.exports = router;
