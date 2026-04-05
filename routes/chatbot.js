const express = require("express");
const router = express.Router();
const { recommendProducts } = require("../controllers/chatbotController");

router.post("/recommend", recommendProducts);

module.exports = router;
