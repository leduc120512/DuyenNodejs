const mongoose = require("mongoose");

const userHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
  },
  action: {
    type: String,
    enum: ["view", "search", "purchase"],
    required: true,
  },
  searchKeyword: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("UserHistory", userHistorySchema);
