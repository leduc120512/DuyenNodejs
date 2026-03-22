const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("Missing MONGODB_URI");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    // ❌ bỏ process.exit
  }
};

module.exports = connectDB;
