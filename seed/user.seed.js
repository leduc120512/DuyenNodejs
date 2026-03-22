require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const seedUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected DB");

    // ❌ Xoá user cũ (tuỳ chọn)
    await User.deleteMany();

    // ✅ Tạo user mới
    const users = [
      {
        username: "admin",
        email: "admin@gmail.com",
        password: "12345678", // sẽ auto hash
        fullName: "Admin",
        role: "admin",
        isEmailVerified: true,
      },
      {
        username: "user1",
        email: "user1@gmail.com",
        password: "12345678",
        fullName: "User One",
      },
    ];

    await User.insertMany(users);

    console.log("🌱 Seed users thành công!");
    process.exit();
  } catch (error) {
    console.error("❌ Seed lỗi:", error);
    process.exit(1);
  }
};

seedUsers();
