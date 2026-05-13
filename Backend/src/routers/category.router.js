const express = require("express");
const { getCategories, getCategory } = require("../controllers/category.controller");

const router = express.Router();

router.get("/", getCategories);
router.get("/:id", getCategory);

module.exports = router;

