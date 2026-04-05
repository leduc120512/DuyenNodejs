const express = require("express");
const router = express.Router();
const {
  aiSearchProducts,
  getSearchHistorySuggestions,
  deleteSearchHistoryKeyword,
  clearAllSearchHistory,
} = require("../controllers/aiSearch.controller");

router.get("/history", getSearchHistorySuggestions);
router.delete("/history", deleteSearchHistoryKeyword);
router.delete("/history/all", clearAllSearchHistory);
router.post("/", aiSearchProducts);

module.exports = router;
