const express = require("express");
const {
   getDashboardSummary,
   repriceDashboardLists,
} = require("../controllers/dashboard.controller");
const verifyToken = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/summary", verifyToken, getDashboardSummary);
router.post("/reprice", verifyToken, repriceDashboardLists);

module.exports = router;
